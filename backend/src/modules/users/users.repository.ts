import pool from '../../config/db.js';
import type { UserRow } from '../auth/auth.types.js';

export class UsersRepository {
  private userColumns = `
    id, clinic_id, parent_user_id, name, mobile_number, email, address,
    date_of_birth, city, state, zip_code, avatar_url, relationship, role, is_verified
  `;

  async findById(id: string): Promise<UserRow | null> {
    const result = await pool.query(
      `SELECT ${this.userColumns}
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async update(id: string, data: Record<string, unknown>): Promise<UserRow | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findById(id);
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${this.userColumns}`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  async create(data: Record<string, unknown>): Promise<UserRow> {
    const keys = Object.keys(data);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `INSERT INTO users (${cols}) VALUES (${placeholders})
       RETURNING ${this.userColumns}`,
      values
    );
    return result.rows[0];
  }

  async findDependentsByParentId(parentId: string): Promise<UserRow[]> {
    const result = await pool.query(
      `SELECT ${this.userColumns}
       FROM users WHERE parent_user_id = $1 AND deleted_at IS NULL`,
      [parentId]
    );
    return result.rows;
  }

  async searchPatients(clinicId: string, query: string): Promise<UserRow[]> {
    const result = await pool.query(
      `SELECT ${this.userColumns}
       FROM users
       WHERE clinic_id = $1
         AND role = 'patient'
         AND deleted_at IS NULL
         AND (name ILIKE $2 OR mobile_number ILIKE $2)
       ORDER BY name
       LIMIT 20`,
      [clinicId, `%${query}%`]
    );
    return result.rows;
  }

  async softDelete(id: string): Promise<void> {
    await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async findDoctorProfile(userId: string): Promise<{ speciality: string | null } | null> {
    const result = await pool.query(
      `SELECT dp.speciality
       FROM doctor_profiles dp
       WHERE dp.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }
}
