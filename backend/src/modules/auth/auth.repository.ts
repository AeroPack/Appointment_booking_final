import pool from '../../config/db.js';
import type { UserRow, OtpRow, RefreshTokenRow, PasswordResetOtpRow } from './auth.types.js';

export class AuthRepository {
  async findUserByMobile(mobile: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, parent_user_id, name, mobile_number, email, role, is_verified
       FROM users
       WHERE mobile_number = $1 AND deleted_at IS NULL`,
      [mobile]
    );
    return result.rows[0] || null;
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, parent_user_id, name, mobile_number, email, role, is_verified
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, parent_user_id, name, mobile_number, email, role, is_verified
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async storeOtp(mobileNumber: string | null, email: string | null, otpHash: string, expiresAt: Date): Promise<void> {
    await pool.query(
      'INSERT INTO otps (mobile_number, email, otp_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [mobileNumber, email, otpHash, expiresAt]
    );
  }

  async findLatestOtp(mobileNumber: string | null, email: string | null): Promise<OtpRow | null> {
    let query: string;
    let params: string[];

    if (mobileNumber) {
      query = `SELECT id, mobile_number, email, otp_hash, expires_at, attempts, used
               FROM otps
               WHERE mobile_number = $1
               ORDER BY created_at DESC
               LIMIT 1`;
      params = [mobileNumber];
    } else {
      query = `SELECT id, mobile_number, email, otp_hash, expires_at, attempts, used
               FROM otps
               WHERE email = $1
               ORDER BY created_at DESC
               LIMIT 1`;
      params = [email!];
    }

    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [id]);
  }

  async markOtpUsed(id: string): Promise<void> {
    await pool.query('UPDATE otps SET used = true WHERE id = $1', [id]);
  }

  async invalidatePriorOtps(mobileNumber: string | null, email: string | null): Promise<void> {
    if (mobileNumber) {
      await pool.query(
        'UPDATE otps SET used = true WHERE mobile_number = $1 AND used = false',
        [mobileNumber]
      );
    } else {
      await pool.query(
        'UPDATE otps SET used = true WHERE email = $1 AND used = false',
        [email!]
      );
    }
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const result = await pool.query(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  }

  // ─── Registration Methods ─────────────────────────────────────────────────────

  /**
   * Create a new user during registration
   */
  async createUser(data: {
    name: string;
    email?: string;
    mobile_number?: string;
    password_hash: string;
    clinic_id: string;
    role: string;
  }): Promise<{ id: string }> {
    const result = await pool.query(
      `INSERT INTO users (name, email, mobile_number, password_hash, clinic_id, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id`,
      [data.name, data.email || null, data.mobile_number || null, data.password_hash, data.clinic_id, data.role]
    );
    return result.rows[0];
  }

  /**
   * Find user by email or mobile (for password login)
   */
  async findUserByEmailOrMobile(emailOrMobile: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, parent_user_id, name, mobile_number, email, role, is_verified, password_hash
       FROM users
       WHERE (email = $1 OR mobile_number = $1) AND deleted_at IS NULL`,
      [emailOrMobile]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark user as verified after OTP verification
   */
  async markUserVerified(userId: string): Promise<void> {
    await pool.query(
      'UPDATE users SET is_verified = true WHERE id = $1',
      [userId]
    );
  }

  /**
   * Update doctor profile
   */
  async upsertDoctorProfile(userId: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const placeholders = keys.map((k, i) => `$${i + 2}`);
    const cols = keys.join(', ');
    const values = keys.map((k) => data[k]);
    
    await pool.query(
      `INSERT INTO doctor_profiles (user_id, ${cols})
       VALUES ($1, ${placeholders.join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(', ')}`,
      [userId, ...values]
    );
  }

  /**
   * Update clinic WhatsApp configuration
   */
  async updateClinicWhatsApp(clinicId: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => data[k]);
    
    await pool.query(
      `UPDATE clinics SET ${setClauses.join(', ')} WHERE id = $1`,
      [clinicId, ...values]
    );
  }

  /**
   * Create a default clinic for new doctor
   */
  async createDefaultClinic(doctorName: string): Promise<string> {
    const result = await pool.query(
      `INSERT INTO clinics (name)
       VALUES ($1)
       RETURNING id`,
      [`${doctorName}'s Clinic`]
    );
    return result.rows[0].id;
  }

  /**
   * Find or create the shared clinic used for self-serve patient
   * accounts that are auto-created on first OTP request (no doctor/clinic context).
   */
  async findOrCreatePlatformClinic(): Promise<string> {
    const platformClinicName = 'Direct Signup';
    const existing = await pool.query(
      `SELECT id FROM clinics WHERE name = $1 LIMIT 1`,
      [platformClinicName]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const result = await pool.query(
      `INSERT INTO clinics (name) VALUES ($1) RETURNING id`,
      [platformClinicName]
    );
    return result.rows[0].id;
  }

  /**
   * Auto-create a patient user on first OTP request for an unrecognized
   * mobile/email. OTP-only account, no password.
   */
  async createSelfServePatient(data: {
    name: string;
    email: string | null;
    mobile_number: string | null;
    clinic_id: string;
  }): Promise<UserRow> {
    const result = await pool.query(
      `INSERT INTO users (name, email, mobile_number, clinic_id, role, is_verified)
       VALUES ($1, $2, $3, $4, 'patient', false)
       RETURNING id, clinic_id, parent_user_id, name, mobile_number, email, role, is_verified`,
      [data.name, data.email, data.mobile_number, data.clinic_id]
    );
    return result.rows[0];
  }

  // ─── Password Reset Methods ───────────────────────────────────────────────────

  /**
   * Store a password reset OTP
   */
  async storePasswordResetOtp(
    userId: string,
    mobileNumber: string | null,
    email: string | null,
    otpHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO password_reset_otps (user_id, mobile_number, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, mobileNumber, email, otpHash, expiresAt],
    );
  }

  /**
   * Find the latest unused password reset OTP for a contact identifier
   */
  async findLatestPasswordResetOtp(mobileNumber: string | null, email: string | null): Promise<PasswordResetOtpRow | null> {
    let query: string;
    let params: string[];

    if (mobileNumber) {
      query = `SELECT id, user_id, mobile_number, email, otp_hash, expires_at, attempts, used
               FROM password_reset_otps
               WHERE mobile_number = $1
               ORDER BY created_at DESC
               LIMIT 1`;
      params = [mobileNumber];
    } else {
      query = `SELECT id, user_id, mobile_number, email, otp_hash, expires_at, attempts, used
               FROM password_reset_otps
               WHERE email = $1
               ORDER BY created_at DESC
               LIMIT 1`;
      params = [email!];
    }

    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Increment attempts on a password reset OTP
   */
  async incrementPasswordResetOtpAttempts(id: string): Promise<void> {
    await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1', [id]);
  }

  /**
   * Mark a password reset OTP as used
   */
  async markPasswordResetOtpUsed(id: string): Promise<void> {
    await pool.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [id]);
  }

  /**
   * Invalidate all prior unused password reset OTPs for a user
   */
  async invalidatePriorPasswordResetOtps(userId: string): Promise<void> {
    await pool.query(
      'UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false',
      [userId],
    );
  }

  /**
   * Update a user's password hash
   */
  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  }
}
