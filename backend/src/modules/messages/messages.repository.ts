import pool from '../../config/db.js';
import type { MessageTemplateRow } from '../settings/settings.types.js';
import type { MessageRow } from './messages.types.js';

const MAX_RETRIES = 3;

export class MessagesRepository {
  async findTemplateById(templateId: string): Promise<MessageTemplateRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, doctor_id, template_type, subject, content,
              offset_minutes, channel, is_active
       FROM message_templates WHERE id = $1`,
      [templateId]
    );
    return result.rows[0] || null;
  }

  async findAppointmentForRender(appointmentId: string): Promise<{
    id: string;
    doctor_id: string;
    patient_id: string;
    scheduled_start: Date;
    scheduled_end: Date;
    token_number: number | null;
    venue_id: string | null;
    venue_name: string | null;
    doctor_name: string;
    patient_name: string;
    clinic_name: string;
  } | null> {
    const result = await pool.query(
      `SELECT a.id, a.doctor_id, a.patient_id, a.scheduled_start, a.scheduled_end,
              a.token_number, a.venue_id, v.name AS venue_name,
              doc.name AS doctor_name, pat.name AS patient_name,
              c.name AS clinic_name
       FROM appointments a
       JOIN users doc ON doc.id = a.doctor_id
       JOIN users pat ON pat.id = a.patient_id
       JOIN clinics c ON c.id = a.clinic_id
       LEFT JOIN venues v ON v.id = a.venue_id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [appointmentId]
    );
    return result.rows[0] || null;
  }

  async findReminderTemplatesForDoctor(doctorId: string): Promise<MessageTemplateRow[]> {
    const result = await pool.query(
      `SELECT id, clinic_id, doctor_id, template_type, subject, content,
              offset_minutes, channel, is_active
       FROM message_templates
       WHERE (doctor_id = $1 OR doctor_id IS NULL)
         AND template_type = 'reminder'
         AND is_active = true
         AND offset_minutes IS NOT NULL
       ORDER BY offset_minutes`,
      [doctorId]
    );
    return result.rows;
  }

  async findConfirmationTemplatesForDoctor(doctorId: string): Promise<MessageTemplateRow[]> {
    const result = await pool.query(
      `SELECT id, clinic_id, doctor_id, template_type, subject, content,
              offset_minutes, channel, is_active
       FROM message_templates
       WHERE (doctor_id = $1 OR doctor_id IS NULL)
         AND template_type = 'booking_confirmation'
         AND is_active = true`,
      [doctorId]
    );
    return result.rows;
  }

  async insertMessage(data: {
    appointment_id: string | null;
    template_id: string | null;
    sender_id: string | null;
    receiver_id: string;
    message_name: string | null;
    content: string;
    channel: string;
    schedule_for: Date | null;
  }): Promise<{ id: string }> {
    const result = await pool.query(
      `INSERT INTO messages (appointment_id, template_id, sender_id, receiver_id, message_name, content, channel, schedule_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        data.appointment_id,
        data.template_id,
        data.sender_id,
        data.receiver_id,
        data.message_name,
        data.content,
        data.channel,
        data.schedule_for,
      ]
    );
    return result.rows[0];
  }

  async lockAndFetchPending(limit: number = 10): Promise<MessageRow[]> {
    const result = await pool.query(
      `SELECT id, appointment_id, template_id, sender_id, receiver_id,
              message_name, content, channel, schedule_for,
              status, retry_count, sent_at
       FROM messages
       WHERE status = 'pending'
         AND (schedule_for IS NULL OR schedule_for <= NOW())
       ORDER BY schedule_for NULLS FIRST
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    return result.rows;
  }

  async markSent(id: string): Promise<void> {
    await pool.query(
      `UPDATE messages SET status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async incrementRetry(id: string): Promise<void> {
    await pool.query(
      `UPDATE messages SET retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async markFailed(id: string): Promise<void> {
    await pool.query(
      `UPDATE messages SET status = 'failed', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async cancelPendingByAppointment(appointmentId: string): Promise<void> {
    await pool.query(
      `DELETE FROM messages
       WHERE appointment_id = $1 AND status = 'pending'`,
      [appointmentId]
    );
  }
}
