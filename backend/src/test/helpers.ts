import pool from '../config/db.js';

export async function seedClinic(): Promise<string> {
  const result = await pool.query(
    `INSERT INTO clinics (name) VALUES ('Test Clinic') RETURNING id`
  );
  return result.rows[0].id;
}

export async function seedUser(overrides: {
  clinicId: string;
  role?: 'doctor' | 'patient' | 'staff';
  name?: string;
  mobile?: string;
}): Promise<{ id: string; clinicId: string; role: string; mobile: string }> {
  const { clinicId, role = 'patient', name = 'Test User', mobile = generateMobile() } = overrides;
  const result = await pool.query(
    `INSERT INTO users (clinic_id, name, mobile_number, role, is_verified)
     VALUES ($1, $2, $3, $4, true) RETURNING id, clinic_id, role, mobile_number`,
    [clinicId, name, mobile, role]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    clinicId: row.clinic_id,
    role: row.role,
    mobile: row.mobile_number,
  };
}

export async function seedOtp(overrides: {
  mobile: string;
  otpHash: string;
  expiresAt?: Date;
  attempts?: number;
  used?: boolean;
}): Promise<string> {
  const {
    mobile,
    otpHash,
    expiresAt = new Date(Date.now() + 5 * 60 * 1000),
    attempts = 0,
    used = false,
  } = overrides;
  const result = await pool.query(
    `INSERT INTO otps (mobile_number, otp_hash, expires_at, attempts, used)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [mobile, otpHash, expiresAt, attempts, used]
  );
  return result.rows[0].id;
}

export async function seedRefreshToken(overrides: {
  userId: string;
  tokenHash: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
}): Promise<string> {
  const {
    userId,
    tokenHash,
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt = null,
  } = overrides;
  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, tokenHash, expiresAt, revokedAt]
  );
  return result.rows[0].id;
}

export async function seedDoctorProfile(userId: string, overrides?: {
  speciality?: string;
  qualification?: string;
  consultation_fee?: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO doctor_profiles (user_id, speciality, qualification, consultation_fee)
     VALUES ($1, $2, $3, $4)`,
    [
      userId,
      overrides?.speciality || 'General Physician',
      overrides?.qualification || 'MBBS',
      overrides?.consultation_fee || 500,
    ]
  );
}

export async function seedVenue(clinicId: string, overrides?: {
  name?: string;
  address?: string;
}): Promise<{ id: string; name: string }> {
  const result = await pool.query(
    `INSERT INTO venues (clinic_id, name, address)
     VALUES ($1, $2, $3) RETURNING id, name`,
    [clinicId, overrides?.name || 'Test Venue', overrides?.address || '123 Test St']
  );
  return result.rows[0];
}

export async function seedAppointmentSetting(doctorId: string, overrides?: {
  venue_id?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  slot_duration_minutes?: number;
  max_patients_per_slot?: number;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO appointment_settings (doctor_id, venue_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients_per_slot)
     VALUES ($1, $2, $3, $4::time, $5::time, $6, $7) RETURNING id`,
    [
      doctorId,
      overrides?.venue_id || null,
      overrides?.day_of_week ?? 1,
      overrides?.start_time || '09:00',
      overrides?.end_time || '10:00',
      overrides?.slot_duration_minutes ?? 15,
      overrides?.max_patients_per_slot ?? 10,
    ]
  );
  return result.rows[0];
}

export async function seedMessageTemplate(clinicId: string, overrides?: {
  doctor_id?: string;
  template_type?: string;
  subject?: string;
  content?: string;
  offset_minutes?: number | null;
  channel?: string;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO message_templates (clinic_id, doctor_id, template_type, subject, content, offset_minutes, channel)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      clinicId,
      overrides?.doctor_id || null,
      overrides?.template_type || 'booking_confirmation',
      overrides?.subject || 'Test Template',
      overrides?.content || 'Hello {{patient_name}}',
      overrides?.offset_minutes ?? null,
      overrides?.channel || 'whatsapp',
    ]
  );
  return result.rows[0];
}

export async function seedAppointment(overrides: {
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  booked_by_user_id: string;
  scheduled_start: Date;
  scheduled_end: Date;
  venue_id?: string;
  appointment_status?: string;
  token_number?: number;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO appointments (clinic_id, doctor_id, patient_id, booked_by_user_id, venue_id, scheduled_start, scheduled_end, appointment_status, token_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      overrides.clinic_id,
      overrides.doctor_id,
      overrides.patient_id,
      overrides.booked_by_user_id,
      overrides.venue_id || null,
      overrides.scheduled_start,
      overrides.scheduled_end,
      overrides.appointment_status || 'booked',
      overrides.token_number ?? null,
    ]
  );
  return result.rows[0];
}

export async function seedMessage(overrides: {
  appointment_id?: string;
  template_id?: string;
  sender_id?: string;
  receiver_id: string;
  message_name?: string;
  content?: string;
  channel?: string;
  schedule_for?: Date;
  status?: string;
  retry_count?: number;
  sent_at?: Date | null;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO messages (appointment_id, template_id, sender_id, receiver_id, message_name, content, channel, schedule_for, status, retry_count, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      overrides.appointment_id || null,
      overrides.template_id || null,
      overrides.sender_id || null,
      overrides.receiver_id,
      overrides.message_name || null,
      overrides.content || 'Test message',
      overrides.channel || 'whatsapp',
      overrides.schedule_for || new Date(),
      overrides.status || 'pending',
      overrides.retry_count ?? 0,
      overrides.sent_at ?? null,
    ]
  );
  return result.rows[0];
}

export async function seedTag(clinicId: string, overrides?: {
  name?: string;
  color?: string;
  is_system?: boolean;
  is_auto?: boolean;
  rule_definition?: Record<string, unknown> | null;
}): Promise<{ id: string; name: string }> {
  const result = await pool.query(
    `INSERT INTO tags (clinic_id, name, color, is_system, is_auto, rule_definition)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
    [
      clinicId,
      overrides?.name || 'Test Tag',
      overrides?.color || null,
      overrides?.is_system ?? false,
      overrides?.is_auto ?? false,
      overrides?.rule_definition ?? null,
    ]
  );
  return result.rows[0];
}

export async function seedUserTag(userId: string, tagId: string, assignedBy?: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_tags (user_id, tag_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, tagId, assignedBy || null]
  );
}

let mobileCounter = 0;

export function generateMobile(): string {
  mobileCounter++;
  return `987654${String(3210 + mobileCounter).padStart(4, '0')}`;
}
