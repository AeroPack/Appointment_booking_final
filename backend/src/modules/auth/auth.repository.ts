import pool from '../../config/db.js';
import type { UserRow, OtpRow, RefreshTokenRow } from './auth.types.js';

export class AuthRepository {
  async findUserByMobile(mobile: string): Promise<UserRow | null> {
    console.log(`[REPO] findUserByMobile query for: ${mobile}`);
    const result = await pool.query(
      `SELECT id, clinic_id, parent_user_id, name, mobile_number, role, is_verified
       FROM users
       WHERE mobile_number = $1 AND deleted_at IS NULL`,
      [mobile]
    );
    console.log(`[REPO] findUserByMobile result rows: ${result.rows.length}`);
    return result.rows[0] || null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, parent_user_id, name, mobile_number, role, is_verified
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async storeOtp(mobile: string, otpHash: string, expiresAt: Date): Promise<void> {
    console.log(`[REPO] storeOtp for mobile: ${mobile}`);
    await pool.query(
      'INSERT INTO otps (mobile_number, otp_hash, expires_at) VALUES ($1, $2, $3)',
      [mobile, otpHash, expiresAt]
    );
    console.log(`[REPO] storeOtp done`);
  }

  async findLatestOtpByMobile(mobile: string): Promise<OtpRow | null> {
    const result = await pool.query(
      `SELECT id, mobile_number, otp_hash, expires_at, attempts, used
       FROM otps
       WHERE mobile_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [mobile]
    );
    return result.rows[0] || null;
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [id]);
  }

  async markOtpUsed(id: string): Promise<void> {
    await pool.query('UPDATE otps SET used = true WHERE id = $1', [id]);
  }

  async invalidatePriorOtps(mobile: string): Promise<void> {
    console.log(`[REPO] invalidatePriorOtps for mobile: ${mobile}`);
    const result = await pool.query(
      'UPDATE otps SET used = true WHERE mobile_number = $1 AND used = false',
      [mobile]
    );
    console.log(`[REPO] invalidated ${result.rowCount} prior OTPs`);
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
