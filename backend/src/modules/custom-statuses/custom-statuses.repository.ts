import pool from '../../config/db.js';
import type { CustomStatusRow } from './custom-statuses.types.js';

export class CustomStatusesRepository {
  async findById(id: string, clinicId: string): Promise<CustomStatusRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, name, color, sort_order, is_system
       FROM custom_statuses WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId]
    );
    return result.rows[0] || null;
  }

  async findByClinic(clinicId: string): Promise<CustomStatusRow[]> {
    const result = await pool.query(
      `SELECT id, clinic_id, name, color, sort_order, is_system
       FROM custom_statuses WHERE clinic_id = $1 ORDER BY sort_order, name`,
      [clinicId]
    );
    return result.rows;
  }

  async findByName(name: string, clinicId: string): Promise<CustomStatusRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, name, color, sort_order, is_system
       FROM custom_statuses WHERE name = $1 AND clinic_id = $2`,
      [name, clinicId]
    );
    return result.rows[0] || null;
  }

  async insert(data: {
    clinic_id: string;
    name: string;
    color?: string | null;
    sort_order?: number;
    is_system?: boolean;
  }): Promise<CustomStatusRow> {
    const result = await pool.query(
      `INSERT INTO custom_statuses (clinic_id, name, color, sort_order, is_system)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, clinic_id, name, color, sort_order, is_system`,
      [
        data.clinic_id,
        data.name,
        data.color ?? null,
        data.sort_order ?? 0,
        data.is_system ?? false,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, clinicId: string, data: Record<string, unknown>): Promise<CustomStatusRow | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findById(id, clinicId);
    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `UPDATE custom_statuses SET ${setClauses.join(', ')} WHERE id = $1 AND clinic_id = $2
       RETURNING id, clinic_id, name, color, sort_order, is_system`,
      [id, clinicId, ...values]
    );
    return result.rows[0] || null;
  }

  async delete(id: string, clinicId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM custom_statuses WHERE id = $1 AND clinic_id = $2',
      [id, clinicId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
