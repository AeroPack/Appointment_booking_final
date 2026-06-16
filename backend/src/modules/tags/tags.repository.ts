import pool from '../../config/db.js';
import type { TagRow, UserTagRow } from './tags.types.js';

export class TagsRepository {
  async findTagById(id: string, clinicId: string): Promise<TagRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, name, color, is_system, is_auto, rule_definition
       FROM tags WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId]
    );
    return result.rows[0] || null;
  }

  async findTagsByClinic(clinicId: string): Promise<TagRow[]> {
    const result = await pool.query(
      `SELECT id, clinic_id, name, color, is_system, is_auto, rule_definition
       FROM tags WHERE clinic_id = $1 ORDER BY name`,
      [clinicId]
    );
    return result.rows;
  }

  async insertTag(data: {
    clinic_id: string;
    name: string;
    color?: string | null;
    is_auto?: boolean;
    rule_definition?: Record<string, unknown> | null;
  }): Promise<TagRow> {
    const result = await pool.query(
      `INSERT INTO tags (clinic_id, name, color, is_auto, rule_definition)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, clinic_id, name, color, is_system, is_auto, rule_definition`,
      [
        data.clinic_id,
        data.name,
        data.color ?? null,
        data.is_auto ?? false,
        data.rule_definition ?? null,
      ]
    );
    return result.rows[0];
  }

  async updateTag(id: string, clinicId: string, data: Record<string, unknown>): Promise<TagRow | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findTagById(id, clinicId);
    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `UPDATE tags SET ${setClauses.join(', ')} WHERE id = $1 AND clinic_id = $2
       RETURNING id, clinic_id, name, color, is_system, is_auto, rule_definition`,
      [id, clinicId, ...values]
    );
    return result.rows[0] || null;
  }

  async deleteTag(id: string, clinicId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM tags WHERE id = $1 AND clinic_id = $2',
      [id, clinicId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async assignUserTag(userId: string, tagId: string, assignedBy: string | null): Promise<void> {
    await pool.query(
      `INSERT INTO user_tags (user_id, tag_id, assigned_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, tagId, assignedBy]
    );
  }

  async unassignUserTag(userId: string, tagId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM user_tags WHERE user_id = $1 AND tag_id = $2',
      [userId, tagId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findUserTags(userId: string): Promise<TagRow[]> {
    const result = await pool.query(
      `SELECT t.id, t.clinic_id, t.name, t.color, t.is_system, t.is_auto, t.rule_definition
       FROM tags t
       JOIN user_tags ut ON ut.tag_id = t.id
       WHERE ut.user_id = $1
       ORDER BY t.name`,
      [userId]
    );
    return result.rows;
  }

  async findUserTag(userId: string, tagId: string): Promise<UserTagRow | null> {
    const result = await pool.query(
      'SELECT user_id, tag_id, assigned_by, assigned_at FROM user_tags WHERE user_id = $1 AND tag_id = $2',
      [userId, tagId]
    );
    return result.rows[0] || null;
  }

  async findAutoTagsByClinic(clinicId: string): Promise<TagRow[]> {
    const result = await pool.query(
      `SELECT id, clinic_id, name, color, is_system, is_auto, rule_definition
       FROM tags WHERE clinic_id = $1 AND is_auto = true`,
      [clinicId]
    );
    return result.rows;
  }

  async countPatientAppointments(patientId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM appointments
       WHERE patient_id = $1
         AND appointment_status IN ('booked', 'finished')
         AND deleted_at IS NULL`,
      [patientId]
    );
    return result.rows[0].count;
  }
}
