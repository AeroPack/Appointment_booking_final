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
      `SELECT m.id, m.appointment_id, m.template_id, m.sender_id, m.receiver_id,
              m.message_name, m.content, m.channel, m.schedule_for,
              m.status, m.retry_count, m.sent_at,
              COALESCE(a.clinic_id, t.clinic_id) AS clinic_id
       FROM messages m
       LEFT JOIN appointments a ON a.id = m.appointment_id
       LEFT JOIN message_templates t ON t.id = m.template_id
       WHERE m.status = 'pending'
         AND (m.schedule_for IS NULL OR m.schedule_for <= NOW())
       ORDER BY m.schedule_for NULLS FIRST
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

  /**
   * Get user contact information for messaging
   * @param userId - User ID
   * @returns User contact details or null if not found
   */
  async getUserContact(userId: string): Promise<{
    whatsapp_number: string | null;
    mobile_number: string | null;
    email: string | null;
  } | null> {
    const result = await pool.query(
      `SELECT whatsapp_number, mobile_number, email
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get WhatsApp configuration for a clinic
   * @param clinicId - Clinic ID
   * @returns WhatsApp configuration or null if not found
   */
  async getWhatsAppConfig(clinicId: string): Promise<{
    instance_id: string;
    token: string;
    whatsapp_number: string;
    whatsapp_enabled: boolean;
  } | null> {
    const result = await pool.query(
      `SELECT ultramsg_instance_id AS instance_id, 
              ultramsg_token AS token,
              whatsapp_number,
              whatsapp_enabled
       FROM clinics WHERE id = $1`,
      [clinicId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find OTP template for a clinic
   * @param clinicId - Clinic ID
   * @returns OTP template or null if not found
   */
  async findOtpTemplateForClinic(clinicId: string): Promise<MessageTemplateRow | null> {
    const result = await pool.query(
      `SELECT id, clinic_id, doctor_id, template_type, subject, content,
              offset_minutes, channel, is_active
       FROM message_templates
       WHERE clinic_id = $1
         AND template_type = 'otp_verification'
         AND is_active = true
       LIMIT 1`,
      [clinicId]
    );
    return result.rows[0] || null;
  }
}
