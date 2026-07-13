import pool from '../../config/db.js';
import type { BotDoctorInfo, BotFaqEntry, BotChatbotConfig, BotPatientLookup } from './bot.types.js';

export class BotRepository {
  async findDoctorInfo(doctorId: string): Promise<BotDoctorInfo | null> {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.name, u.avatar_url,
              dp.speciality, dp.qualification, dp.bio, dp.consultation_fee,
              dp.title, dp.experience_years,
              v.name AS venue_name, v.address AS venue_address
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       LEFT JOIN appointment_settings s ON s.doctor_id = u.id AND s.is_active = true
       LEFT JOIN venues v ON v.id = s.venue_id
       WHERE u.id = $1 AND u.role = 'doctor' AND u.deleted_at IS NULL
       LIMIT 1`,
      [doctorId]
    );
    return result.rows[0] || null;
  }

  async findSettingsByDoctorAndDay(doctorId: string, dayOfWeek: number) {
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

  async findPatientByPhone(phone: string): Promise<{ id: string; name: string; mobile_number: string | null } | null> {
    const result = await pool.query(
      `SELECT id, name, mobile_number
       FROM users
       WHERE mobile_number = $1 AND role = 'patient' AND deleted_at IS NULL
       LIMIT 1`,
      [phone]
    );
    return result.rows[0] || null;
  }

  async createPatient(data: { name: string; phone: string; clinicId: string }): Promise<{ id: string; name: string; mobile_number: string | null }> {
    const result = await pool.query(
      `INSERT INTO users (name, mobile_number, clinic_id, role)
       VALUES ($1, $2, $3, 'patient')
       RETURNING id, name, mobile_number`,
      [data.name, data.phone, data.clinicId]
    );
    return result.rows[0];
  }

  async findClinicForDoctor(doctorId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT clinic_id FROM users WHERE id = $1 AND role = 'doctor' AND deleted_at IS NULL`,
      [doctorId]
    );
    return result.rows[0]?.clinic_id || null;
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
    notes?: string;
  }): Promise<{ id: string }> {
    const result = await pool.query(
      `INSERT INTO appointments (clinic_id, doctor_id, patient_id, booked_by_user_id, venue_id, scheduled_start, scheduled_end, token_number, appointment_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'checkup', $9) RETURNING id`,
      [
        data.clinic_id,
        data.doctor_id,
        data.patient_id,
        data.booked_by_user_id,
        data.venue_id,
        data.scheduled_start,
        data.scheduled_end,
        data.token_number,
        data.notes || null,
      ]
    );
    return result.rows[0];
  }

  async findFaqByDoctor(doctorId: string): Promise<BotFaqEntry[]> {
    const result = await pool.query(
      `SELECT id, question, answer
       FROM doctor_faq
       WHERE doctor_id = $1 AND is_active = true
       ORDER BY created_at`,
      [doctorId]
    );
    return result.rows;
  }

  async findChatbotConfig(doctorId: string): Promise<BotChatbotConfig | null> {
    const result = await pool.query(
      `SELECT is_enabled, primary_color, greeting_msg, position
       FROM doctor_chatbot_config
       WHERE doctor_id = $1`,
      [doctorId]
    );
    return result.rows[0] || null;
  }

  async upsertChatbotConfig(doctorId: string, data: {
    is_enabled?: boolean;
    primary_color?: string;
    greeting_msg?: string;
    position?: string;
  }): Promise<void> {
    const keys = Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined);
    if (keys.length === 0) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => data[k as keyof typeof data]);
    await pool.query(
      `INSERT INTO doctor_chatbot_config (doctor_id, ${keys.join(', ')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (doctor_id) DO UPDATE SET ${setClauses.join(', ')}`,
      [doctorId, ...values]
    );
  }

  async createFaqEntry(doctorId: string, data: { question: string; answer: string; keywords?: string[] }): Promise<{ id: string }> {
    const result = await pool.query(
      `INSERT INTO doctor_faq (doctor_id, question, answer, keywords)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [doctorId, data.question, data.answer, data.keywords || []]
    );
    return result.rows[0];
  }

  async updateFaqEntry(id: string, doctorId: string, data: { question?: string; answer?: string; keywords?: string[] }): Promise<boolean> {
    const keys = Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined);
    if (keys.length === 0) return false;
    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => data[k as keyof typeof data]);
    const result = await pool.query(
      `UPDATE doctor_faq SET ${setClauses.join(', ')} WHERE id = $1 AND doctor_id = $2`,
      [id, doctorId, ...values]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteFaqEntry(id: string, doctorId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM doctor_faq WHERE id = $1 AND doctor_id = $2`,
      [id, doctorId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listFaqByDoctor(doctorId: string): Promise<BotFaqEntry[]> {
    const result = await pool.query(
      `SELECT id, question, answer
       FROM doctor_faq
       WHERE doctor_id = $1
       ORDER BY created_at`,
      [doctorId]
    );
    return result.rows;
  }

  async findPastAppointmentCount(patientId: string, doctorId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2 AND deleted_at IS NULL`,
      [patientId, doctorId]
    );
    return result.rows[0].count;
  }

  async findDoctorExists(doctorId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND role = 'doctor' AND deleted_at IS NULL`,
      [doctorId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
