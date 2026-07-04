import pool from '../../config/db.js';
import type { UserRow, OtpRow, RefreshTokenRow } from './auth.types.js';

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
}
