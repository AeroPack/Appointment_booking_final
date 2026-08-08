import pool, { withTransaction } from '../../config/db.js';
import type { UserRow, OtpRow, RefreshTokenRow, PasswordResetOtpRow } from './auth.types.js';

/** Every column the service needs to make an auth decision. */
const USER_COLUMNS = `id, clinic_id, parent_user_id, name, mobile_number, email,
                      role, is_verified, password_hash`;

export class AuthRepository {
  // ─── Lookups ──────────────────────────────────────────────────────────────
  //
  // Identifiers arrive already canonicalized (src/utils/phone.ts). These are
  // exact matches, so passing a raw user-typed number here will silently miss.

  async findUserByMobile(mobile: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE mobile_number = $1 AND deleted_at IS NULL`,
      [mobile]
    );
    return result.rows[0] || null;
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /** Resolve a login identifier that may be either an email or a mobile number. */
  async findUserByEmailOrMobile(email: string | null, mobile: string | null): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE deleted_at IS NULL
         AND (($1::text IS NOT NULL AND email = $1) OR ($2::text IS NOT NULL AND mobile_number = $2))
       ORDER BY created_at ASC
       LIMIT 1`,
      [email, mobile]
    );
    return result.rows[0] || null;
  }

  // ─── OTPs ─────────────────────────────────────────────────────────────────
  //
  // Keyed by user_id, not by identifier. Matching on the raw identifier meant a
  // registration OTP sent to an email could never be found (the lookup preferred
  // the mobile branch), and a stale login OTP for the same number could satisfy
  // a registration verify.

  async storeOtp(
    userId: string,
    mobileNumber: string | null,
    email: string | null,
    otpHash: string,
    expiresAt: Date
  ): Promise<void> {
    await pool.query(
      `INSERT INTO otps (user_id, mobile_number, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, mobileNumber, email, otpHash, expiresAt]
    );
  }

  async findLatestOtp(userId: string): Promise<OtpRow | null> {
    const result = await pool.query(
      `SELECT id, user_id, mobile_number, email, otp_hash, expires_at, attempts, used
       FROM otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [id]);
  }

  async markOtpUsed(id: string): Promise<void> {
    await pool.query('UPDATE otps SET used = true WHERE id = $1', [id]);
  }

  /** Requesting a new code retires every earlier one for that account. */
  async invalidatePriorOtps(userId: string): Promise<void> {
    await pool.query(
      'UPDATE otps SET used = true WHERE user_id = $1 AND used = false',
      [userId]
    );
  }

  // ─── Refresh tokens ───────────────────────────────────────────────────────

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const result = await pool.query(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [id]);
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  }

  // ─── Account creation ─────────────────────────────────────────────────────

  /**
   * Create a doctor together with the clinic they own, atomically.
   * These were two independent statements before, so a failure between them
   * left an orphan clinic and the retry created a second one.
   * @returns The new user's id and clinic id
   */
  async createDoctorWithClinic(data: {
    name: string;
    email: string | null;
    mobile_number: string | null;
    password_hash: string;
  }): Promise<{ id: string; clinic_id: string }> {
    return withTransaction(async (client) => {
      const clinic = await client.query(
        `INSERT INTO clinics (name) VALUES ($1) RETURNING id`,
        [`${data.name}'s Clinic`]
      );
      const clinicId = clinic.rows[0].id;

      const user = await client.query(
        `INSERT INTO users (name, email, mobile_number, password_hash, clinic_id, role, is_verified)
         VALUES ($1, $2, $3, $4, $5, 'doctor', false)
         RETURNING id`,
        [data.name, data.email, data.mobile_number, data.password_hash, clinicId]
      );

      return { id: user.rows[0].id, clinic_id: clinicId };
    });
  }

  /**
   * Re-run signup over an abandoned, still-unverified doctor account.
   * Keeps the existing clinic: a retry must not strand the first one.
   */
  async reclaimDoctorSignup(data: {
    id: string;
    name: string;
    email: string | null;
    mobile_number: string | null;
    password_hash: string;
  }): Promise<void> {
    await pool.query(
      `UPDATE users
          SET name = $2,
              email = COALESCE($3, email),
              mobile_number = COALESCE($4, mobile_number),
              password_hash = $5,
              is_verified = false
        WHERE id = $1`,
      [data.id, data.name, data.email, data.mobile_number, data.password_hash]
    );
  }

  /**
   * Auto-create a patient on first OTP request for an unrecognized identifier.
   * Patients are temporary accounts: OTP only, no password, no signup step.
   */
  async createSelfServePatient(data: {
    name: string;
    email: string | null;
    mobile_number: string | null;
  }): Promise<UserRow> {
    const clinicId = await this.findOrCreatePlatformClinic();
    const result = await pool.query(
      `INSERT INTO users (name, email, mobile_number, clinic_id, role, is_verified)
       VALUES ($1, $2, $3, $4, 'patient', false)
       RETURNING ${USER_COLUMNS}`,
      [data.name, data.email, data.mobile_number, clinicId]
    );
    return result.rows[0];
  }

  /** The shared clinic that self-serve patients belong to until a doctor claims them. */
  private async findOrCreatePlatformClinic(): Promise<string> {
    const name = 'Direct Signup';
    const existing = await pool.query('SELECT id FROM clinics WHERE name = $1 LIMIT 1', [name]);
    if (existing.rows[0]) return existing.rows[0].id;

    const created = await pool.query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', [name]);
    return created.rows[0].id;
  }

  async markUserVerified(userId: string): Promise<void> {
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  }

  // ─── Doctor profile / clinic settings ─────────────────────────────────────

  async upsertDoctorProfile(userId: string, data: Record<string, unknown>): Promise<void> {
    const columns = Object.keys(data);
    if (columns.length === 0) return;

    const placeholders = columns.map((_, i) => `$${i + 2}`);
    const assignments = columns.map((col, i) => `${col} = $${i + 2}`);

    await pool.query(
      `INSERT INTO doctor_profiles (user_id, ${columns.join(', ')})
       VALUES ($1, ${placeholders.join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${assignments.join(', ')}, updated_at = NOW()`,
      [userId, ...Object.values(data)]
    );
  }

  async updateClinicWhatsApp(clinicId: string, data: Record<string, unknown>): Promise<void> {
    const columns = Object.keys(data);
    if (columns.length === 0) return;

    const assignments = columns.map((col, i) => `${col} = $${i + 2}`);
    await pool.query(
      `UPDATE clinics SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $1`,
      [clinicId, ...Object.values(data)]
    );
  }

  // ─── Password reset ───────────────────────────────────────────────────────

  async storePasswordResetOtp(
    userId: string,
    mobileNumber: string | null,
    email: string | null,
    otpHash: string,
    expiresAt: Date
  ): Promise<void> {
    await pool.query(
      `INSERT INTO password_reset_otps (user_id, mobile_number, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, mobileNumber, email, otpHash, expiresAt]
    );
  }

  async findLatestPasswordResetOtp(userId: string): Promise<PasswordResetOtpRow | null> {
    const result = await pool.query(
      `SELECT id, user_id, mobile_number, email, otp_hash, expires_at, attempts, used
       FROM password_reset_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async incrementPasswordResetOtpAttempts(id: string): Promise<void> {
    await pool.query(
      'UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1',
      [id]
    );
  }

  async markPasswordResetOtpUsed(id: string): Promise<void> {
    await pool.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [id]);
  }

  async invalidatePriorPasswordResetOtps(userId: string): Promise<void> {
    await pool.query(
      'UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false',
      [userId]
    );
  }
}
