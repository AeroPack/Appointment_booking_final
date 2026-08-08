/**
 * Auth Service
 *
 * Two account kinds, two ways in, and they do not overlap:
 *
 *   doctor  - permanent. Signs up at /register, signs in with a password.
 *   patient - temporary. No signup at all; the account is created on first OTP
 *             request and only ever authenticates with a one-time code.
 *
 * Every method here takes contacts already canonicalized by src/utils/phone.ts.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { hashToken, verifyToken, generateOtp } from '../../utils/hash.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../../utils/email.js';
import { AppError } from '../../utils/response.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { channelRegistry } from '../../utils/channels/index.js';
import type {
  AuthPayload, AuthIdentifier, UserRow, OtpRow, PasswordResetOtpRow,
  RegisterInput, LoginPasswordInput, UpdateProfileInput, SetupWhatsAppInput,
  ForgotPasswordInput, VerifyPasswordResetInput, ResetPasswordInput,
} from './auth.types.js';
import { AuthRepository } from './auth.repository.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MS / 1000;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const isProduction = () => process.env['NODE_ENV'] === 'production';

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function isEmail(id: AuthIdentifier): id is { email: string } {
  return 'email' in id;
}

function identifierLabel(id: AuthIdentifier): string {
  return isEmail(id) ? id.email : id.mobile_number;
}

/** What to call the channel in a user-facing message. */
function channelName(id: AuthIdentifier): string {
  return isEmail(id) ? 'email' : 'mobile number';
}

/**
 * Log an OTP for local debugging only. A code printed to a production log is a
 * credential sitting in plaintext for anyone with log access.
 */
function traceOtp(label: string, otp: string): void {
  if (!isProduction()) {
    console.log(`[OTP] ${label}: ${otp}`);
  }
}

/** The user shape returned alongside a token pair. One shape for every login path. */
function toAuthUser(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    clinic_id: user.clinic_id,
    mobile_number: user.mobile_number,
    email: user.email,
  };
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  // ─── Token issuing ────────────────────────────────────────────────────────

  /**
   * Issue an access/refresh pair for a user.
   * @param user - The authenticated account
   * @returns Tokens plus the user shape the clients expect
   */
  private async issueSession(user: UserRow) {
    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_id,
    };

    const accessToken = jwt.sign(payload as object, getJwtSecret(), {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    await this.repo.storeRefreshToken(
      user.id,
      hashToken(refreshToken),
      new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
    );

    return { accessToken, refreshToken, user: toAuthUser(user) };
  }

  // ─── OTP issuing and checking ─────────────────────────────────────────────

  /**
   * Generate, store, and deliver a fresh OTP for an account.
   * @param user - Account the code belongs to
   * @param identifier - Where to send it
   * @returns The generated code (for non-production echo only)
   */
  private async issueOtp(user: UserRow, identifier: AuthIdentifier): Promise<string> {
    await this.repo.invalidatePriorOtps(user.id);

    const otp = generateOtp();
    await this.repo.storeOtp(
      user.id,
      isEmail(identifier) ? null : identifier.mobile_number,
      isEmail(identifier) ? identifier.email : null,
      hashToken(otp),
      new Date(Date.now() + OTP_EXPIRY_MS)
    );

    traceOtp(identifierLabel(identifier), otp);
    await this.deliverOtp(identifier, otp, user.clinic_id);

    return otp;
  }

  /**
   * Deliver an OTP over the channel the identifier implies.
   * Throws on failure: reporting "code sent" for a code that was never sent
   * leaves the user waiting with no way to tell that delivery broke.
   */
  private async deliverOtp(identifier: AuthIdentifier, otp: string, clinicId: string): Promise<void> {
    try {
      if (isEmail(identifier)) {
        await sendOtpEmail(identifier.email, otp);
      } else {
        await this.sendOtpWhatsApp(identifier.mobile_number, otp, clinicId);
      }
    } catch (err) {
      console.error(`[auth] OTP delivery failed for ${identifierLabel(identifier)}:`, err);
      throw new AppError(
        502,
        'OTP_SEND_FAILED',
        'Could not send the verification code. Please try again in a moment.'
      );
    }
  }

  private async sendOtpWhatsApp(mobileNumber: string, otp: string, clinicId: string): Promise<void> {
    const whatsapp = channelRegistry.get('whatsapp');
    if (!whatsapp) {
      throw new Error('WhatsApp channel not registered');
    }

    // `params` fills the approved auth template; `content` is the fallback body.
    const result = await whatsapp.sendMessage({
      to: mobileNumber,
      content: `Your verification code is: ${otp}. It expires in 5 minutes.`,
      clinicId,
      options: { type: 'auth_otp', params: otp },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp OTP');
    }
  }

  /**
   * Check a submitted code against an account's latest OTP.
   * Records a failed attempt; the caller consumes the row on success.
   * @param row - The account's most recent OTP, if any
   * @param otp - The code the user submitted
   */
  private async assertOtpValid(row: OtpRow | null, otp: string): Promise<OtpRow> {
    if (!row) {
      throw new AppError(401, 'OTP_NOT_FOUND', 'No verification code was requested. Request a new one.');
    }
    if (row.used) {
      throw new AppError(401, 'OTP_USED', 'This code has already been used. Request a new one.');
    }
    if (new Date() > row.expires_at) {
      throw new AppError(401, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    if (row.attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(401, 'OTP_LOCKED', 'Too many incorrect attempts. Request a new code.');
    }

    if (!verifyToken(otp, row.otp_hash)) {
      await this.repo.incrementOtpAttempts(row.id);
      const remaining = MAX_OTP_ATTEMPTS - (row.attempts + 1);
      throw new AppError(401, 'INVALID_OTP', `Incorrect code. ${remaining} attempt(s) remaining.`);
    }

    return row;
  }

  // ─── Patient sign-in (OTP only) ───────────────────────────────────────────

  /**
   * Send a login code. An unrecognized identifier becomes a new patient:
   * patients are temporary accounts and have no signup step of their own.
   * @param identifier - Canonicalized email or mobile number
   * @returns The generated code (echoed to non-production clients only)
   */
  async sendOtp(identifier: AuthIdentifier): Promise<string> {
    let user = await this.findByIdentifier(identifier);

    if (!user) {
      user = await this.repo.createSelfServePatient({
        name: isEmail(identifier) ? 'New Patient' : `Patient ${identifier.mobile_number.slice(-4)}`,
        email: isEmail(identifier) ? identifier.email : null,
        mobile_number: isEmail(identifier) ? null : identifier.mobile_number,
      });
    }

    this.assertNotDoctor(user);
    return this.issueOtp(user, identifier);
  }

  /**
   * Verify a login code and start a session.
   * @param identifier - Canonicalized email or mobile number
   * @param otp - The submitted code
   * @returns Access token, refresh token, and the user
   */
  async verifyOtpAndLogin(identifier: AuthIdentifier, otp: string) {
    const user = await this.findByIdentifier(identifier);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `No account found with this ${channelName(identifier)}.`);
    }

    this.assertNotDoctor(user);

    const row = await this.assertOtpValid(await this.repo.findLatestOtp(user.id), otp);
    await this.repo.markOtpUsed(row.id);
    await this.repo.markUserVerified(user.id);

    return this.issueSession({ ...user, is_verified: true });
  }

  /** Doctors hold a password; sending them a login code would create a second way in. */
  private assertNotDoctor(user: UserRow): void {
    if (user.role === 'doctor') {
      throw new AppError(400, 'USE_PASSWORD_LOGIN', 'Doctor accounts sign in with a password.');
    }
  }

  private async findByIdentifier(identifier: AuthIdentifier): Promise<UserRow | null> {
    return isEmail(identifier)
      ? this.repo.findUserByEmail(identifier.email)
      : this.repo.findUserByMobile(identifier.mobile_number);
  }

  // ─── Doctor sign-up ───────────────────────────────────────────────────────

  /**
   * Register a doctor and send them a verification code.
   * The account and its clinic are created atomically, then the code is sent -
   * so a delivery failure leaves a resumable signup, not an orphan clinic.
   * @param input - Name, password, and at least one contact (already canonical)
   * @returns The new user's id and how long the code lasts
   */
  async register(input: RegisterInput): Promise<{ user_id: string; expires_in: number }> {
    const email = input.email ?? null;
    const mobile = input.mobile_number ?? null;

    const existing = await this.resolveSignupConflict(email, mobile);
    const passwordHash = await hashPassword(input.password);

    let userId: string;

    if (existing) {
      // Their own abandoned signup: reuse the row and its clinic.
      await this.repo.reclaimDoctorSignup({
        id: existing.id,
        name: input.name,
        email,
        mobile_number: mobile,
        password_hash: passwordHash,
      });
      userId = existing.id;
    } else {
      const created = await this.repo.createDoctorWithClinic({
        name: input.name,
        email,
        mobile_number: mobile,
        password_hash: passwordHash,
      });
      userId = created.id;
    }

    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Could not create the account.');
    }

    // Send to whichever contact they supplied; email wins when both are given.
    const identifier: AuthIdentifier = email ? { email } : { mobile_number: mobile! };
    await this.issueOtp(user, identifier);

    return { user_id: user.id, expires_in: OTP_EXPIRY_SECONDS };
  }

  /**
   * Decide whether a signup may proceed over an account that already holds one
   * of these contacts.
   * @returns The reclaimable account, or null when both contacts are free
   */
  private async resolveSignupConflict(
    email: string | null,
    mobile: string | null
  ): Promise<UserRow | null> {
    const byEmail = email ? await this.repo.findUserByEmail(email) : null;
    const byMobile = mobile ? await this.repo.findUserByMobile(mobile) : null;

    if (byEmail && byMobile && byEmail.id !== byMobile.id) {
      throw new AppError(
        409,
        'USER_EXISTS',
        'That email and mobile number belong to two different accounts.'
      );
    }

    const existing = byEmail ?? byMobile;
    if (!existing) return null;

    const contactWord = byEmail ? 'email' : 'mobile number';

    if (existing.is_verified) {
      throw new AppError(409, 'USER_EXISTS', `An account with this ${contactWord} already exists.`);
    }

    // A patient shell was never a doctor signup. Promoting it silently would let
    // anyone claim a number someone else already uses to receive codes.
    if (existing.role !== 'doctor') {
      throw new AppError(
        409,
        'IDENTIFIER_IN_USE',
        `This ${contactWord} is already registered to a patient account. Use a different one.`
      );
    }

    return existing;
  }

  /**
   * Verify a signup code and start the doctor's first session.
   * @param userId - The id returned by register()
   * @param otp - The submitted code
   */
  async verifyRegistrationOtp(userId: string, otp: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
    }

    const row = await this.assertOtpValid(await this.repo.findLatestOtp(user.id), otp);
    await this.repo.markOtpUsed(row.id);
    await this.repo.markUserVerified(user.id);

    return this.issueSession({ ...user, is_verified: true });
  }

  // ─── Doctor sign-in ───────────────────────────────────────────────────────

  /**
   * Sign a doctor in with their password.
   * @param input - Contact and password; the contact is canonicalized upstream
   */
  async loginWithPassword(input: LoginPasswordInput) {
    const user = await this.repo.findUserByEmailOrMobile(
      input.email ?? null,
      input.mobile_number ?? null
    );
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this email or mobile number.');
    }

    if (user.role !== 'doctor') {
      throw new AppError(400, 'USE_OTP_LOGIN', 'This account signs in with a one-time code.');
    }

    if (!user.password_hash) {
      throw new AppError(400, 'NO_PASSWORD', 'This account has no password set.');
    }

    if (!(await verifyPassword(input.password, user.password_hash))) {
      throw new AppError(401, 'INVALID_PASSWORD', 'Incorrect password.');
    }

    // Skipping this made OTP verification optional: an abandoned signup could
    // sign in with nothing but the password it had set.
    if (!user.is_verified) {
      throw new AppError(
        403,
        'ACCOUNT_UNVERIFIED',
        'Please verify your account with the code we sent before signing in.'
      );
    }

    return this.issueSession(user);
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    const stored = await this.repo.findRefreshTokenByHash(hashToken(rawRefreshToken));
    if (!stored) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token.');
    }

    if (stored.revoked_at) {
      // A revoked token being replayed means it leaked. Drop every session.
      await this.repo.revokeAllUserRefreshTokens(stored.user_id);
      throw new AppError(401, 'TOKEN_REUSED', 'Session revoked. Please sign in again.');
    }

    if (new Date() > stored.expires_at) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Session expired. Please sign in again.');
    }

    await this.repo.revokeRefreshToken(stored.id);

    const user = await this.repo.findUserById(stored.user_id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
    }

    const { accessToken, refreshToken } = await this.issueSession(user);
    return { accessToken, refreshToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const stored = await this.repo.findRefreshTokenByHash(hashToken(rawRefreshToken));
    if (stored) {
      await this.repo.revokeRefreshToken(stored.id);
    }
  }

  async me(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
    }
    return toAuthUser(user);
  }

  // ─── Doctor profile / clinic settings ─────────────────────────────────────

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    // Copied field by field: upsertDoctorProfile builds column names from these
    // keys, so it must never receive an unvalidated body.
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.speciality !== undefined) data.speciality = input.speciality;
    if (input.qualification !== undefined) data.qualification = input.qualification;
    if (input.registration_number !== undefined) data.registration_number = input.registration_number;
    if (input.consultation_fee !== undefined) data.consultation_fee = input.consultation_fee;
    if (input.experience_years !== undefined) data.experience_years = input.experience_years;
    if (input.bio !== undefined) data.bio = input.bio;

    await this.repo.upsertDoctorProfile(userId, data);
  }

  async setupWhatsApp(userId: string, input: SetupWhatsAppInput): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
    }

    const data: Record<string, unknown> = {};
    if (input.whatsapp_enabled !== undefined) data.whatsapp_enabled = input.whatsapp_enabled;
    if (input.ultramsg_instance_id !== undefined) data.ultramsg_instance_id = input.ultramsg_instance_id;
    if (input.ultramsg_token !== undefined) data.ultramsg_token = input.ultramsg_token;
    if (input.whatsapp_number !== undefined) data.whatsapp_number = input.whatsapp_number;

    await this.repo.updateClinicWhatsApp(user.clinic_id, data);
  }

  // ─── Password reset ───────────────────────────────────────────────────────

  /**
   * Send a password reset code.
   * Always reports success: a 404 here would tell an attacker which contacts
   * have accounts. Returns the code so non-production clients can echo it.
   * @param input - The contact to send to (already canonicalized)
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ expires_in: number; otp?: string }> {
    const identifier = this.toIdentifier(input);
    const user = await this.findByIdentifier(identifier);

    // Nothing to reset (no such account, or an OTP-only patient) - but the
    // response must be indistinguishable from the success case.
    if (!user?.password_hash) {
      return { expires_in: OTP_EXPIRY_SECONDS };
    }

    await this.repo.invalidatePriorPasswordResetOtps(user.id);

    const otp = generateOtp();
    await this.repo.storePasswordResetOtp(
      user.id,
      isEmail(identifier) ? null : identifier.mobile_number,
      isEmail(identifier) ? identifier.email : null,
      hashToken(otp),
      new Date(Date.now() + OTP_EXPIRY_MS)
    );
    traceOtp(`password reset for ${identifierLabel(identifier)}`, otp);

    try {
      if (isEmail(identifier)) {
        await sendPasswordResetEmail(identifier.email, otp);
      } else {
        await this.sendOtpWhatsApp(identifier.mobile_number, otp, user.clinic_id);
      }
    } catch (err) {
      console.error(`[auth] Password reset delivery failed for ${user.id}:`, err);
      throw new AppError(
        502,
        'OTP_SEND_FAILED',
        'Could not send the verification code. Please try again in a moment.'
      );
    }

    return { expires_in: OTP_EXPIRY_SECONDS, otp };
  }

  /**
   * Check a reset code without consuming it, so the UI can advance a step.
   * resetPassword checks it again - this is a convenience, not the authorization.
   */
  async verifyPasswordResetOtp(input: VerifyPasswordResetInput): Promise<{ valid: true }> {
    await this.loadVerifiedResetRequest(input, input.otp);
    return { valid: true };
  }

  /**
   * Set a new password, then sign every device out.
   * The code is verified here and consumed here. This method previously ignored
   * the submitted code entirely and authorized on a user_id the API itself had
   * handed to the client, which also left the reset replayable.
   */
  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const { user, row } = await this.loadVerifiedResetRequest(input, input.otp);

    await this.repo.markPasswordResetOtpUsed(row.id);
    await this.repo.updatePasswordHash(user.id, await hashPassword(input.new_password));
    await this.repo.revokeAllUserRefreshTokens(user.id);

    return { message: 'Password reset successful' };
  }

  /**
   * Resolve a reset request to its account and prove the code is correct.
   * @returns The account and the OTP row authorizing the request
   */
  private async loadVerifiedResetRequest(
    input: { email?: string; mobile_number?: string },
    otp: string
  ): Promise<{ user: UserRow; row: PasswordResetOtpRow }> {
    const identifier = this.toIdentifier(input);
    const user = await this.findByIdentifier(identifier);

    // Same message whether the account is missing or has no reset in flight:
    // the failure must not reveal which.
    const invalid = new AppError(401, 'INVALID_OTP', 'That code is not valid. Request a new one.');
    if (!user) throw invalid;

    const row = await this.repo.findLatestPasswordResetOtp(user.id);
    if (!row) throw invalid;

    if (new Date() > row.expires_at) {
      throw new AppError(401, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    if (row.used) {
      throw new AppError(401, 'OTP_USED', 'This code has already been used. Request a new one.');
    }
    if (row.attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(401, 'OTP_LOCKED', 'Too many incorrect attempts. Request a new code.');
    }

    if (!verifyToken(otp, row.otp_hash)) {
      await this.repo.incrementPasswordResetOtpAttempts(row.id);
      const remaining = MAX_OTP_ATTEMPTS - (row.attempts + 1);
      throw new AppError(401, 'INVALID_OTP', `Incorrect code. ${remaining} attempt(s) remaining.`);
    }

    return { user, row };
  }

  private toIdentifier(input: { email?: string; mobile_number?: string }): AuthIdentifier {
    if (input.email) return { email: input.email };
    if (input.mobile_number) return { mobile_number: input.mobile_number };
    throw new AppError(400, 'MISSING_CONTACT', 'An email or mobile number is required.');
  }
}
