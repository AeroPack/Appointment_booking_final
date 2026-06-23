import pool from '../../config/db.js';
import type { DoctorOwnProfileRow, DoctorProfileRow, VenueRow, VenueWithAddress, BookingPoliciesRow, DoctorLeaveRow } from './doctors.types.js';

export interface DoctorListItem {
  id: string;
  name: string;
  avatar_url: string | null;
  speciality: string | null;
  consultation_fee: string | null;
  title: string | null;
  experience_years: number | null;
  bio: string | null;
  primary_venue_name: string | null;
  available_today: boolean;
}

export class DoctorsRepository {
  async findDoctorProfile(doctorId: string, clinicId: string): Promise<DoctorProfileRow | null> {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.name, u.avatar_url,
              dp.speciality, dp.qualification, dp.registration_number, dp.bio, dp.consultation_fee,
              dp.title, dp.experience_years, dp.patient_count, dp.awards_count, dp.publications_count
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1 AND u.clinic_id = $2 AND u.role = 'doctor' AND u.deleted_at IS NULL`,
      [doctorId, clinicId]
    );
    return result.rows[0] || null;
  }

  async findDoctorVenues(doctorId: string): Promise<VenueWithAddress[]> {
    const result = await pool.query(
      `SELECT DISTINCT v.id, v.name, v.address
       FROM appointment_settings s
       JOIN venues v ON v.id = s.venue_id
       WHERE s.doctor_id = $1 AND s.is_active = true`,
      [doctorId]
    );
    return result.rows;
  }

  async findAllDoctors(clinicId: string, speciality?: string): Promise<DoctorListItem[]> {
    let query = `
      SELECT u.id, u.name, u.avatar_url,
             dp.speciality, dp.consultation_fee, dp.title, dp.experience_years, dp.bio,
             (SELECT v.name FROM appointment_settings s
              JOIN venues v ON v.id = s.venue_id
              WHERE s.doctor_id = u.id AND s.is_active = true
              LIMIT 1) AS primary_venue_name,
             EXISTS (
               SELECT 1 FROM appointment_settings s2
               WHERE s2.doctor_id = u.id
                 AND s2.day_of_week = EXTRACT(ISODOW FROM CURRENT_DATE)
                 AND s2.is_active = true
             ) AS available_today
      FROM users u
      LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
      WHERE u.clinic_id = $1 AND u.role = 'doctor' AND u.deleted_at IS NULL`;
    const params: unknown[] = [clinicId];
    if (speciality) {
      query += ' AND dp.speciality = $2';
      params.push(speciality);
    }
    query += ' ORDER BY u.name';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async findVenuesByClinic(clinicId: string): Promise<VenueRow[]> {
    const result = await pool.query(
      'SELECT id, clinic_id, name, address, phone, is_active FROM venues WHERE clinic_id = $1 ORDER BY name',
      [clinicId]
    );
    return result.rows;
  }

  async findVenueById(id: string, clinicId: string): Promise<VenueRow | null> {
    const result = await pool.query(
      'SELECT id, clinic_id, name, address, phone, is_active FROM venues WHERE id = $1 AND clinic_id = $2',
      [id, clinicId]
    );
    return result.rows[0] || null;
  }

  async findOwnDoctorProfile(userId: string, clinicId: string): Promise<DoctorOwnProfileRow | null> {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.mobile_number, u.address, u.date_of_birth,
              u.city, u.state, u.zip_code, u.avatar_url, u.is_verified,
              dp.title, dp.speciality, dp.qualification, dp.registration_number,
              dp.bio, dp.consultation_fee, dp.experience_years
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1 AND u.clinic_id = $2 AND u.role = 'doctor' AND u.deleted_at IS NULL`,
      [userId, clinicId]
    );
    return result.rows[0] || null;
  }

  async upsertDoctorProfile(userId: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const placeholders = keys.map((k, i) => `$${i + 2}`);
    const cols = keys.join(', ');
    const values = keys.map((k) => data[k]);
    await pool.query(
      `INSERT INTO doctor_profiles (user_id, ${cols})
       VALUES ($1, ${placeholders.join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(', ')}`,
      [userId, ...values]
    );
  }

  async createVenue(clinicId: string, data: { name: string; address?: string; phone?: string }): Promise<VenueRow> {
    const result = await pool.query(
      `INSERT INTO venues (clinic_id, name, address, phone)
       VALUES ($1, $2, $3, $4) RETURNING id, clinic_id, name, address, phone, is_active`,
      [clinicId, data.name, data.address || null, data.phone || null]
    );
    return result.rows[0];
  }

  async updateVenue(id: string, clinicId: string, data: Record<string, unknown>): Promise<VenueRow | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findVenueById(id, clinicId);
    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => data[k]);
    const result = await pool.query(
      `UPDATE venues SET ${setClauses.join(', ')} WHERE id = $1 AND clinic_id = $2
       RETURNING id, clinic_id, name, address, phone, is_active`,
      [id, clinicId, ...values]
    );
    return result.rows[0] || null;
  }

  // ─── Booking Policies ───────────────────────────────────────────────────────

  async getBookingPolicies(userId: string): Promise<BookingPoliciesRow | null> {
    const result = await pool.query(
      `SELECT booking_min_notice_hours, booking_max_advance_days,
              auto_confirm_bookings, cancellation_window_hours
       FROM doctor_profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async updateBookingPolicies(userId: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = keys.map((k) => data[k]);
    await pool.query(
      `UPDATE doctor_profiles SET ${setClauses.join(', ')} WHERE user_id = $1`,
      [userId, ...values]
    );
  }

  // ─── Doctor Leaves ──────────────────────────────────────────────────────────

  async findLeaves(doctorId: string): Promise<DoctorLeaveRow[]> {
    const result = await pool.query(
      `SELECT id, doctor_id, start_date, end_date, reason, created_at
       FROM doctor_leaves WHERE doctor_id = $1 ORDER BY start_date`,
      [doctorId]
    );
    return result.rows;
  }

  async createLeave(doctorId: string, data: { start_date: string; end_date: string; reason?: string }): Promise<DoctorLeaveRow> {
    const result = await pool.query(
      `INSERT INTO doctor_leaves (doctor_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, doctor_id, start_date, end_date, reason, created_at`,
      [doctorId, data.start_date, data.end_date, data.reason || null]
    );
    return result.rows[0];
  }

  async deleteLeave(leaveId: string, doctorId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM doctor_leaves WHERE id = $1 AND doctor_id = $2`,
      [leaveId, doctorId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
