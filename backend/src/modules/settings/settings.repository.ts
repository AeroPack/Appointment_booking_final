import pool from '../../config/db.js';
import type { AppointmentSettingRow, MessageTemplateRow, UserSettingsRow } from './settings.types.js';

export class SettingsRepository {
  async findSettingsByDoctor(doctorId: string, clinicId: string): Promise<AppointmentSettingRow[]> {
    const result = await pool.query(
      `SELECT s.id, s.doctor_id, s.venue_id, s.day_of_week,
              s.start_time::text, s.end_time::text,
              s.slot_duration_minutes, s.max_patients_per_slot, s.is_active
       FROM appointment_settings s
       JOIN users u ON u.id = s.doctor_id
       WHERE s.doctor_id = $1 AND u.clinic_id = $2 AND s.is_active = true
       ORDER BY s.day_of_week, s.start_time`,
      [doctorId, clinicId]
    );
    return result.rows;
  }

  async deleteSettingsByDoctor(doctorId: string): Promise<void> {
    await pool.query('DELETE FROM appointment_settings WHERE doctor_id = $1', [doctorId]);
  }

  async insertSetting(data: {
    doctor_id: string;
    venue_id: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    max_patients_per_slot: number;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO appointment_settings (doctor_id, venue_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients_per_slot)
       VALUES ($1, $2, $3, $4::time, $5::time, $6, $7)`,
      [
        data.doctor_id,
        data.venue_id,
        data.day_of_week,
        data.start_time,
        data.end_time,
        data.slot_duration_minutes,
        data.max_patients_per_slot,
      ]
    );
  }

  async findTemplatesByDoctor(
    clinicId: string,
    doctorId?: string
  ): Promise<MessageTemplateRow[]> {
    const result = await pool.query(
      `SELECT id, clinic_id, doctor_id, template_type, subject, content,
              offset_minutes, channel, is_active
       FROM message_templates
       WHERE clinic_id = $1
         AND (doctor_id = $2 OR doctor_id IS NULL)
       ORDER BY offset_minutes NULLS LAST`,
      [clinicId, doctorId || null]
    );
    return result.rows;
  }

  async deleteTemplatesByDoctor(clinicId: string, doctorId: string): Promise<void> {
    await pool.query(
      'DELETE FROM message_templates WHERE clinic_id = $1 AND doctor_id = $2',
      [clinicId, doctorId]
    );
  }

  async insertTemplate(data: {
    clinic_id: string;
    doctor_id?: string | null;
    template_type: string;
    subject?: string | null;
    content: string;
    offset_minutes?: number | null;
    channel?: string;
  }): Promise<MessageTemplateRow> {
    const result = await pool.query(
      `INSERT INTO message_templates (clinic_id, doctor_id, template_type, subject, content, offset_minutes, channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, clinic_id, doctor_id, template_type, subject, content, offset_minutes, channel, is_active`,
      [
        data.clinic_id,
        data.doctor_id || null,
        data.template_type,
        data.subject || null,
        data.content,
        data.offset_minutes ?? null,
        data.channel || 'whatsapp',
      ]
    );
    return result.rows[0];
  }

  async findTemplateById(id: string, clinicId: string): Promise<MessageTemplateRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, doctor_id, template_type, subject, content,
              offset_minutes, channel, is_active
       FROM message_templates WHERE id = $1 AND clinic_id = $2`,
      [id, clinicId]
    );
    return result.rows[0] || null;
  }

  async updateTemplate(
    id: string,
    clinicId: string,
    data: Record<string, unknown>
  ): Promise<MessageTemplateRow | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findTemplateById(id, clinicId);
    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `UPDATE message_templates SET ${setClauses.join(', ')} WHERE id = $1 AND clinic_id = $2
       RETURNING id, clinic_id, doctor_id, template_type, subject, content, offset_minutes, channel, is_active`,
      [id, clinicId, ...values]
    );
    return result.rows[0] || null;
  }

  async deleteTemplate(id: string, clinicId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM message_templates WHERE id = $1 AND clinic_id = $2',
      [id, clinicId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findVenueName(venueId: string): Promise<string | null> {
    const result = await pool.query(
      'SELECT name FROM venues WHERE id = $1',
      [venueId]
    );
    return result.rows[0]?.name || null;
  }

  async findUserSettings(userId: string): Promise<UserSettingsRow | null> {
    const result = await pool.query(
      `SELECT user_id, notifications_enabled, language
       FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async upsertUserSettings(userId: string, data: Record<string, unknown>): Promise<UserSettingsRow> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findUserSettings(userId);
      if (existing) return existing;
      const result = await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1)
         RETURNING user_id, notifications_enabled, language`,
        [userId]
      );
      return result.rows[0];
    }
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `INSERT INTO user_settings (user_id, ${keys.join(', ')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses.map((c, i) => c.replace(` = $${i + 2}`, ` = EXCLUDED.${keys[i]}`)).join(', ')}
       RETURNING user_id, notifications_enabled, language`,
      [userId, ...values]
    );
    return result.rows[0];
  }
}
