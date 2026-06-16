import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { hashToken, verifyToken, generateOtp } from '../../utils/hash.js';
import { AppError } from '../../utils/response.js';
import type { AuthPayload } from './auth.types.js';
import { AuthRepository } from './auth.repository.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload as object, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async sendOtp(mobile: string): Promise<string> {
    console.log(`[SERVICE] sendOtp called for mobile: ${mobile}`);
    const user = await this.repo.findUserByMobile(mobile);
    if (!user) {
      console.log(`[SERVICE] User not found for mobile: ${mobile}`);
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this mobile number');
    }
    console.log(`[SERVICE] User found: ${user.id} (${user.name})`);

    await this.repo.invalidatePriorOtps(mobile);
    console.log(`[SERVICE] Prior OTPs invalidated`);

    const otp = generateOtp();
    console.log(`[SERVICE] OTP generated: ${otp}`);
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    console.log(`[SERVICE] Storing OTP hash in DB...`);
    await this.repo.storeOtp(mobile, otpHash, expiresAt);
    console.log(`[SERVICE] OTP stored successfully`);
    console.log(`[OTP] OTP for ${mobile}: ${otp}`);

    return otp;
  }

  async verifyOtpAndLogin(mobile: string, otp: string) {
    const user = await this.repo.findUserByMobile(mobile);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this mobile number');
    }

    const otpRow = await this.repo.findLatestOtpByMobile(mobile);
    if (!otpRow) {
      throw new AppError(401, 'OTP_NOT_FOUND', 'No OTP requested for this number');
    }

    if (otpRow.used) {
      throw new AppError(401, 'OTP_USED', 'OTP has already been used');
    }

    if (new Date() > otpRow.expires_at) {
      throw new AppError(401, 'OTP_EXPIRED', 'OTP has expired');
    }

    if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(401, 'OTP_LOCKED', 'Too many failed attempts. Request a new OTP.');
    }

    const isValid = verifyToken(otp, otpRow.otp_hash);
    if (!isValid) {
      await this.repo.incrementOtpAttempts(otpRow.id);
      const remaining = MAX_OTP_ATTEMPTS - (otpRow.attempts + 1);
      throw new AppError(401, 'INVALID_OTP', `Invalid OTP. ${remaining} attempt(s) remaining`);
    }

    await this.repo.markOtpUsed(otpRow.id);

    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_id,
    };

    const accessToken = signAccessToken(payload);
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await this.repo.storeRefreshToken(user.id, refreshTokenHash, expiresAt);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        mobile_number: user.mobile_number,
      },
    };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);
    if (!stored) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    if (stored.revoked_at) {
      await this.repo.revokeAllUserRefreshTokens(stored.user_id);
      throw new AppError(401, 'TOKEN_REUSED', 'Refresh token has been revoked. All sessions revoked.');
    }

    if (new Date() > stored.expires_at) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token has expired');
    }

    await this.repo.revokeRefreshToken(stored.id);

    const user = await this.repo.findUserById(stored.user_id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_id,
    };

    const accessToken = signAccessToken(payload);
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await this.repo.storeRefreshToken(user.id, newRefreshTokenHash, expiresAt);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);
    if (stored) {
      await this.repo.revokeRefreshToken(stored.id);
    }
  }

  async me(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return user;
  }
}
