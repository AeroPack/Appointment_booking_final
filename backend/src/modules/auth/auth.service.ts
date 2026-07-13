import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { hashToken, verifyToken, generateOtp } from '../../utils/hash.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../../utils/email.js';
import { AppError } from '../../utils/response.js';
import type { AuthPayload, AuthIdentifier, RegisterInput, LoginPasswordInput, UpdateProfileInput, SetupWhatsAppInput, ForgotPasswordInput, ResetPasswordInput } from './auth.types.js';
import { AuthRepository } from './auth.repository.js';
import { channelRegistry } from '../../utils/channels/index.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';

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

function isEmail(id: AuthIdentifier): id is { email: string } {
  return 'email' in id;
}

function identifierLabel(id: AuthIdentifier): string {
  return isEmail(id) ? id.email : id.mobile_number;
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async sendOtp(identifier: AuthIdentifier): Promise<string> {
    const label = identifierLabel(identifier);
    console.log(`[SERVICE] sendOtp called for ${isEmail(identifier) ? 'email' : 'mobile'}: ${label}`);

    let user = isEmail(identifier)
      ? await this.repo.findUserByEmail(identifier.email)
      : await this.repo.findUserByMobile(identifier.mobile_number);

    if (!user) {
      // No signup step for patients: an unrecognized identifier becomes a new
      // patient account right here, then proceeds through the normal OTP flow.
      const clinicId = await this.repo.findOrCreatePlatformClinic();
      const placeholderName = isEmail(identifier)
        ? 'New Patient'
        : `Patient ${identifier.mobile_number.slice(-4)}`;
      user = await this.repo.createSelfServePatient({
        name: placeholderName,
        email: isEmail(identifier) ? identifier.email : null,
        mobile_number: isEmail(identifier) ? null : identifier.mobile_number,
        clinic_id: clinicId,
      });
    }

    if (user.role === 'doctor') {
      throw new AppError(400, 'USE_PASSWORD_LOGIN', 'Doctor accounts sign in with a password.');
    }

    const mobileNumber = isEmail(identifier) ? null : identifier.mobile_number;
    const email = isEmail(identifier) ? identifier.email : null;

    await this.repo.invalidatePriorOtps(mobileNumber, email);

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.repo.storeOtp(mobileNumber, email, otpHash, expiresAt);
    console.log(`[OTP] OTP for ${label}: ${otp}`);

    if (isEmail(identifier)) {
      try {
        await sendOtpEmail(identifier.email, otp);
        console.log(`[SERVICE] OTP email sent to ${identifier.email}`);
      } catch (err) {
        console.error(`[SERVICE] Failed to send OTP email to ${identifier.email}:`, err);
      }
    } else {
      // Send OTP via WhatsApp for mobile numbers
      try {
        await this.sendOtpWhatsApp(identifier.mobile_number, otp, user.clinic_id);
        console.log(`[SERVICE] OTP WhatsApp sent to ${identifier.mobile_number}`);
      } catch (err) {
        console.error(`[SERVICE] Failed to send OTP WhatsApp to ${identifier.mobile_number}:`, err);
      }
    }

    return otp;
  }

  /**
   * Send OTP via WhatsApp
   * @param mobileNumber - Recipient mobile number
   * @param otp - OTP code to send
   * @param clinicId - Clinic ID for configuration lookup
   */
  private async sendOtpWhatsApp(mobileNumber: string, otp: string, clinicId: string): Promise<void> {
    const whatsappChannel = channelRegistry.get('whatsapp');
    if (!whatsappChannel) {
      console.warn('[AuthService] WhatsApp channel not registered, skipping OTP send');
      return;
    }

    const message = `Your verification code is: ${otp}. It expires in 5 minutes.`;
    
    const result = await whatsappChannel.sendMessage({
      to: mobileNumber,
      content: message,
      clinicId,
      options: { type: 'auth_otp' },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp OTP');
    }
  }

  /**
   * Send registration OTP (used during doctor signup)
   * Skips the doctor role check that blocks login OTP for doctors.
   * @param identifier - Email or mobile number identifier
   * @param clinicId - Clinic ID for WhatsApp config lookup
   */
  private async sendRegistrationOtp(identifier: AuthIdentifier, clinicId: string): Promise<string> {
    const label = identifierLabel(identifier);

    const mobileNumber = isEmail(identifier) ? null : identifier.mobile_number;
    const email = isEmail(identifier) ? identifier.email : null;

    await this.repo.invalidatePriorOtps(mobileNumber, email);

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.repo.storeOtp(mobileNumber, email, otpHash, expiresAt);
    console.log(`[OTP] Registration OTP for ${label}: ${otp}`);

    if (isEmail(identifier)) {
      try {
        await sendOtpEmail(identifier.email, otp);
        console.log(`[SERVICE] Registration OTP email sent to ${identifier.email}`);
      } catch (err) {
        console.error(`[SERVICE] Failed to send registration OTP email to ${identifier.email}:`, err);
      }
    } else {
      try {
        await this.sendOtpWhatsApp(identifier.mobile_number, otp, clinicId);
        console.log(`[SERVICE] Registration OTP WhatsApp sent to ${identifier.mobile_number}`);
      } catch (err) {
        console.error(`[SERVICE] Failed to send registration OTP WhatsApp to ${identifier.mobile_number}:`, err);
      }
    }

    return otp;
  }

  async verifyOtpAndLogin(identifier: AuthIdentifier, otp: string) {
    const mobileNumber = isEmail(identifier) ? null : identifier.mobile_number;
    const email = isEmail(identifier) ? identifier.email : null;

    const user = isEmail(identifier)
      ? await this.repo.findUserByEmail(identifier.email)
      : await this.repo.findUserByMobile(identifier.mobile_number);

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `No account found with this ${isEmail(identifier) ? 'email' : 'mobile number'}`);
    }

    if (user.role === 'doctor') {
      throw new AppError(400, 'USE_PASSWORD_LOGIN', 'Doctor accounts sign in with a password.');
    }

    const otpRow = await this.repo.findLatestOtp(mobileNumber, email);
    if (!otpRow) {
      throw new AppError(401, 'OTP_NOT_FOUND', `No OTP requested for this ${isEmail(identifier) ? 'email' : 'number'}`);
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
    await this.repo.markUserVerified(user.id);

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
        email: user.email,
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

  // ─── Registration Methods ─────────────────────────────────────────────────────

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ user_id: string; expires_in: number }> {
    // Validate input
    if (!input.email && !input.mobile_number) {
      throw new AppError(400, 'MISSING_CONTACT', 'Either email or mobile number is required');
    }

    // Check if user already exists
    if (input.email) {
      const existingUser = await this.repo.findUserByEmail(input.email);
      if (existingUser) {
        throw new AppError(409, 'USER_EXISTS', 'User with this email already exists');
      }
    }

    if (input.mobile_number) {
      const existingUser = await this.repo.findUserByMobile(input.mobile_number);
      if (existingUser) {
        throw new AppError(409, 'USER_EXISTS', 'User with this mobile number already exists');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create default clinic for the doctor
    const clinicId = await this.repo.createDefaultClinic(input.name);

    // Create user
    const user = await this.repo.createUser({
      name: input.name,
      email: input.email,
      mobile_number: input.mobile_number,
      password_hash: passwordHash,
      clinic_id: clinicId,
      role: 'doctor',
    });

    // Send OTP for verification
    const identifier: AuthIdentifier = input.email 
      ? { email: input.email } 
      : { mobile_number: input.mobile_number! };
    
    const otp = await this.sendRegistrationOtp(identifier, clinicId);

    return {
      user_id: user.id,
      expires_in: 300, // 5 minutes
    };
  }

  /**
   * Verify registration OTP and complete registration
   */
  async verifyRegistrationOtp(userId: string, otp: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthPayload & { name: string; mobile_number: string | null; email: string | null };
  }> {
    // Find user
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Find OTP
    const otpRow = await this.repo.findLatestOtp(user.mobile_number, user.email);
    if (!otpRow) {
      throw new AppError(401, 'OTP_NOT_FOUND', 'No OTP requested');
    }

    if (otpRow.used) {
      throw new AppError(401, 'OTP_USED', 'OTP has already been used');
    }

    if (new Date() > otpRow.expires_at) {
      throw new AppError(401, 'OTP_EXPIRED', 'OTP has expired');
    }

    if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(401, 'OTP_LOCKED', 'Too many failed attempts');
    }

    // Verify OTP
    const isValid = verifyToken(otp, otpRow.otp_hash);
    if (!isValid) {
      await this.repo.incrementOtpAttempts(otpRow.id);
      const remaining = MAX_OTP_ATTEMPTS - (otpRow.attempts + 1);
      throw new AppError(401, 'INVALID_OTP', `Invalid OTP. ${remaining} attempt(s) remaining`);
    }

    // Mark OTP as used
    await this.repo.markOtpUsed(otpRow.id);

    // Mark user as verified
    await this.repo.markUserVerified(userId);

    // Generate tokens
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
        ...payload,
        name: user.name,
        mobile_number: user.mobile_number,
        email: user.email,
      },
    };
  }

  /**
   * Login with password
   */
  async loginWithPassword(input: LoginPasswordInput) {
    // Find user by email or mobile
    const user = await this.repo.findUserByEmailOrMobile(input.email_or_mobile);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this email or mobile number');
    }

    if (user.role !== 'doctor') {
      throw new AppError(400, 'USE_OTP_LOGIN', 'This account signs in with an OTP.');
    }

    // Check if password exists
    if (!user.password_hash) {
      throw new AppError(400, 'NO_PASSWORD', 'This account does not have a password set. Please use OTP login.');
    }

    // Verify password
    const isValid = await verifyPassword(input.password, user.password_hash);
    if (!isValid) {
      throw new AppError(401, 'INVALID_PASSWORD', 'Invalid password');
    }

    // Generate tokens
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
        email: user.email,
      },
    };
  }

  /**
   * Update doctor profile after registration
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.speciality !== undefined) data.speciality = input.speciality;
    if (input.qualification !== undefined) data.qualification = input.qualification;
    if (input.registration_number !== undefined) data.registration_number = input.registration_number;
    if (input.consultation_fee !== undefined) data.consultation_fee = input.consultation_fee;
    if (input.experience_years !== undefined) data.experience_years = input.experience_years;
    if (input.bio !== undefined) data.bio = input.bio;

    if (Object.keys(data).length > 0) {
      await this.repo.upsertDoctorProfile(userId, data);
    }
  }

  /**
   * Setup WhatsApp configuration for the clinic
   */
  async setupWhatsApp(userId: string, input: SetupWhatsAppInput): Promise<void> {
    // Get user to find clinic_id
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const data: Record<string, unknown> = {};
    if (input.whatsapp_enabled !== undefined) data.whatsapp_enabled = input.whatsapp_enabled;
    if (input.ultramsg_instance_id !== undefined) data.ultramsg_instance_id = input.ultramsg_instance_id;
    if (input.ultramsg_token !== undefined) data.ultramsg_token = input.ultramsg_token;
    if (input.whatsapp_number !== undefined) data.whatsapp_number = input.whatsapp_number;

    if (Object.keys(data).length > 0) {
      await this.repo.updateClinicWhatsApp(user.clinic_id, data);
    }
  }

  // ─── Password Reset Methods ───────────────────────────────────────────────────

  /**
   * Initiate forgot password flow: validate user, send OTP via email or WhatsApp
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ user_id: string; expires_in: number; otp: string }> {
    if (!input.email && !input.mobile_number) {
      throw new AppError(400, 'MISSING_CONTACT', 'Either email or mobile number is required');
    }

    const identifier = input.email || input.mobile_number!;
    const user = await this.repo.findUserByEmailOrMobile(identifier);

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `No account found with this ${input.email ? 'email' : 'mobile number'}`);
    }

    if (!user.password_hash) {
      throw new AppError(400, 'NO_PASSWORD', 'This account does not use password login.');
    }

    const requestedEmail = input.email;
    const requestedMobile = input.mobile_number;

    const contactEmail = input.email || user.email;
    const contactMobile = input.mobile_number || user.mobile_number;

    await this.repo.invalidatePriorPasswordResetOtps(user.id);

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.repo.storePasswordResetOtp(user.id, contactMobile, contactEmail, otpHash, expiresAt);
    console.log(`[OTP] Password reset OTP for ${user.id}: ${otp}`);

    if (requestedEmail) {
      try {
        await sendPasswordResetEmail(requestedEmail, otp);
        console.log(`[SERVICE] Password reset OTP email sent to ${requestedEmail}`);
      } catch (err) {
        console.error(`[SERVICE] Failed to send password reset email to ${requestedEmail}:`, err);
      }
    } else if (requestedMobile) {
      try {
        await this.sendOtpWhatsApp(requestedMobile, otp, user.clinic_id);
        console.log(`[SERVICE] Password reset OTP WhatsApp sent to ${requestedMobile}`);
      } catch (err) {
        console.error(`[SERVICE] Failed to send password reset WhatsApp to ${requestedMobile}:`, err);
      }
    }

    return { user_id: user.id, expires_in: 300, otp };
  }

  /**
   * Verify the password reset OTP. Marks OTP as used on success but does NOT issue tokens.
   */
  async verifyPasswordResetOtp(userId: string, otp: string): Promise<{ valid: true }> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const otpRow = await this.repo.findLatestPasswordResetOtp(user.mobile_number, user.email);
    if (!otpRow) {
      throw new AppError(401, 'OTP_NOT_FOUND', 'No password reset OTP requested');
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
      await this.repo.incrementPasswordResetOtpAttempts(otpRow.id);
      const remaining = MAX_OTP_ATTEMPTS - (otpRow.attempts + 1);
      throw new AppError(401, 'INVALID_OTP', `Invalid OTP. ${remaining} attempt(s) remaining`);
    }

    await this.repo.markPasswordResetOtpUsed(otpRow.id);
    return { valid: true };
  }

  /**
   * Reset password after OTP verification. Revokes all refresh tokens.
   */
  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const user = await this.repo.findUserById(input.user_id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const otpRow = await this.repo.findLatestPasswordResetOtp(user.mobile_number, user.email);
    if (!otpRow) {
      throw new AppError(401, 'OTP_NOT_FOUND', 'No password reset OTP requested');
    }

    if (!otpRow.used) {
      throw new AppError(401, 'OTP_NOT_VERIFIED', 'OTP has not been verified yet');
    }

    // Ensure OTP was verified within the last 5 minutes
    if (new Date() > otpRow.expires_at) {
      throw new AppError(401, 'OTP_EXPIRED', 'Password reset session expired. Request a new code.');
    }

    const passwordHash = await hashPassword(input.new_password);
    await this.repo.updatePasswordHash(user.id, passwordHash);

    // Force re-login on all devices
    await this.repo.revokeAllUserRefreshTokens(user.id);

    return { message: 'Password reset successful' };
  }
}
