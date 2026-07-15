import pool from '../../config/db.js';
import type { AppointmentSettingRow } from '../settings/settings.types.js';

export class AppointmentsRepository {
  async findSettingsByDoctorAndDay(doctorId: string, dayOfWeek: number): Promise<(AppointmentSettingRow & { venue_name: string | null })[]> {
    const result = await pool.query(
      `SELECT s.id, s.doctor_id, s.venue_id, s.day_of_week,
              s.start_time::text, s.end_time::text,
              s.slot_duration_minutes, s.max_patients_per_slot, s.is_active,
              v.name AS venue_name
       FROM appointment_settings s
       LEFT JOIN venues v ON v.id = s.venue_id
       WHERE s.doctor_id = $1 AND s.day_of_week = $2 AND s.is_active = true
       ORDER BY s.start_time`,
      [doctorId, dayOfWeek]
    );
    return result.rows;
  }

  async findBookingMinNoticeHours(doctorId: string): Promise<number> {
    const result = await pool.query(
      `SELECT booking_min_notice_hours FROM doctor_profiles WHERE user_id = $1`,
      [doctorId]
    );
    return result.rows[0]?.booking_min_notice_hours ?? 0;
  }

  async findBookedCounts(doctorId: string, dateStr: string): Promise<{ slot_time: string; count: number }[]> {
    const result = await pool.query(
      `SELECT (scheduled_start AT TIME ZONE 'Asia/Kolkata')::time AS slot_time, COUNT(*)::int AS count
       FROM appointments
       WHERE doctor_id = $1
         AND (scheduled_start AT TIME ZONE 'Asia/Kolkata')::date = $2
         AND appointment_status IN ('booked', 'finished')
         AND deleted_at IS NULL
       GROUP BY slot_time`,
      [doctorId, dateStr]
    );
    return result.rows;
  }

  async findActiveSettingForDoctor(doctorId: string): Promise<AppointmentSettingRow | null> {
    const result = await pool.query(
      `SELECT id, doctor_id, venue_id, day_of_week,
              start_time::text AS start_time, end_time::text AS end_time,
              slot_duration_minutes, max_patients_per_slot, is_active
       FROM appointment_settings
       WHERE doctor_id = $1 AND is_active = true
       LIMIT 1`,
      [doctorId]
    );
    return result.rows[0] || null;
  }

  async findBookedCountForSlot(doctorId: string, scheduledStart: Date, scheduledEnd: Date): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM appointments
       WHERE doctor_id = $1
         AND scheduled_start >= $2 AND scheduled_start < $3
         AND appointment_status IN ('booked', 'finished')
         AND deleted_at IS NULL`,
      [doctorId, scheduledStart, scheduledEnd]
    );
    return result.rows[0].count;
  }

  async getNextTokenNumber(doctorId: string, dateStr: string): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next
       FROM appointments
       WHERE doctor_id = $1
         AND (scheduled_start AT TIME ZONE 'Asia/Kolkata')::date = $2`,
      [doctorId, dateStr]
    );
    return result.rows[0].next;
  }

  async insertAppointment(data: {
    clinic_id: string;
    doctor_id: string;
    patient_id: string;
    booked_by_user_id: string;
    venue_id: string | null;
    scheduled_start: Date;
    scheduled_end: Date;
    token_number: number;
    appointment_type: string;
    notes?: string;
  }): Promise<{ id: string }> {
    const result = await pool.query(
      `INSERT INTO appointments (clinic_id, doctor_id, patient_id, booked_by_user_id, venue_id, scheduled_start, scheduled_end, token_number, appointment_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        data.clinic_id,
        data.doctor_id,
        data.patient_id,
        data.booked_by_user_id,
        data.venue_id,
        data.scheduled_start,
        data.scheduled_end,
        data.token_number,
        data.appointment_type,
        data.notes || null,
      ]
    );
    return result.rows[0];
  }

  async findIdempotency(key: string): Promise<{ appointment_id: string } | null> {
    const result = await pool.query(
      `SELECT appointment_id FROM booking_idempotency WHERE idempotency_key = $1`,
      [key]
    );
    return result.rows[0] || null;
  }

  async saveIdempotency(key: string, appointmentId: string): Promise<void> {
    await pool.query(
      `INSERT INTO booking_idempotency (idempotency_key, appointment_id) VALUES ($1, $2)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [key, appointmentId]
    );
  }

  private appointmentDetailColumns = `
    a.id, a.doctor_id, a.patient_id, a.clinic_id,
    a.scheduled_start, a.scheduled_end,
    a.token_number, a.appointment_status, a.appointment_type, a.venue_id,
    v.name AS venue_name,
    doc.name AS doctor_name, doc.mobile_number AS doctor_mobile,
    pat.name AS patient_name,
    a.clinical_notes AS notes
  `;

  async findAppointmentById(id: string): Promise<{
    id: string;
    doctor_id: string;
    patient_id: string;
    clinic_id: string;
    scheduled_start: Date;
    scheduled_end: Date;
    token_number: number | null;
    appointment_status: string;
    appointment_type: string;
    venue_id: string | null;
    venue_name: string | null;
    doctor_name: string;
    doctor_mobile: string | null;
    patient_name: string;
    notes: string | null;
  } | null> {
    const result = await pool.query(
      `SELECT ${this.appointmentDetailColumns}
       FROM appointments a
       JOIN users doc ON doc.id = a.doctor_id
       JOIN users pat ON pat.id = a.patient_id
       LEFT JOIN venues v ON v.id = a.venue_id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAppointmentsByUser(
    userId: string,
    status?: string
  ): Promise<Array<{
    id: string;
    doctor_id: string;
    patient_id: string;
    scheduled_start: Date;
    scheduled_end: Date;
    token_number: number | null;
    appointment_status: string;
    venue_id: string | null;
    venue_name: string | null;
    doctor_name: string;
    patient_name: string;
  }>> {
    const conditions = [
      `a.deleted_at IS NULL`,
      `(a.booked_by_user_id = $1 OR a.patient_id = $1 OR a.patient_id IN (SELECT id FROM users WHERE parent_user_id = $1))`
    ];
    const params: unknown[] = [userId];
    if (status) {
      const statuses = status.split(',').filter(Boolean);
      const placeholders = statuses.map((_, i) => `$${i + 2}`).join(',');
      conditions.push(`a.appointment_status IN (${placeholders})`);
      params.push(...statuses);
    }
    const result = await pool.query(
      `SELECT a.id, a.doctor_id, a.patient_id,
              a.scheduled_start, a.scheduled_end,
              a.token_number, a.appointment_status, a.venue_id,
              v.name AS venue_name,
              doc.name AS doctor_name,
              pat.name AS patient_name
       FROM appointments a
       JOIN users doc ON doc.id = a.doctor_id
       JOIN users pat ON pat.id = a.patient_id
       LEFT JOIN venues v ON v.id = a.venue_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.scheduled_start DESC`,
      params
    );
    return result.rows;
  }

  async updateAppointmentStatus(
    id: string,
    newStatus: string
  ): Promise<void> {
    await pool.query(
      `UPDATE appointments SET appointment_status = $1 WHERE id = $2`,
      [newStatus, id]
    );
  }

  async updateAppointmentNotes(
    id: string,
    notes: string
  ): Promise<void> {
    await pool.query(
      `UPDATE appointments SET clinical_notes = $1 WHERE id = $2`,
      [notes, id]
    );
  }

  async updateAppointment(
    id: string,
    data: {
      patient_id?: string;
      scheduled_start?: Date;
      scheduled_end?: Date;
      venue_id?: string | null;
      appointment_type?: string;
    }
  ): Promise<void> {
    const keys = Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined);
    if (keys.length === 0) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => data[k as keyof typeof data]);
    await pool.query(
      `UPDATE appointments SET ${setClauses.join(', ')} WHERE id = $1`,
      [id, ...values]
    );
  }

  async insertStatusHistory(data: {
    appointment_id: string;
    old_status: string | null;
    new_status: string;
    changed_by: string;
    reason?: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO appointment_status_history (appointment_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.appointment_id, data.old_status, data.new_status, data.changed_by, data.reason || null]
    );
  }

  async findStatusHistory(appointmentId: string): Promise<Array<{
    id: string;
    old_status: string | null;
    new_status: string;
    changed_by: string | null;
    reason: string | null;
    created_at: Date;
  }>> {
    const result = await pool.query(
      `SELECT id, old_status, new_status, changed_by, reason, created_at
       FROM appointment_status_history
       WHERE appointment_id = $1
       ORDER BY created_at ASC`,
      [appointmentId]
    );
    return result.rows;
  }
}
