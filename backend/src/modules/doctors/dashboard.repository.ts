import pool from '../../config/db.js';
import type { DoctorStats, TodayPatient, VenueTypeStat } from './dashboard.types.js';

export class DashboardRepository {
  async findStats(doctorId: string, from: string, to: string): Promise<DoctorStats> {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total_patients,
         COUNT(*) FILTER (WHERE appointment_status = 'booked')::int AS booked,
         COUNT(*) FILTER (WHERE appointment_status = 'finished')::int AS finished,
         COUNT(*) FILTER (WHERE appointment_status = 'no_show')::int AS no_show
       FROM appointments
       WHERE doctor_id = $1
         AND (scheduled_start AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2 AND $3
         AND deleted_at IS NULL`,
      [doctorId, from, to]
    );
    return result.rows[0];
  }

  async findPatients(doctorId: string, from: string, to: string): Promise<TodayPatient[]> {
    const result = await pool.query(
      `SELECT a.id,
              a.patient_id,
              pat.name AS patient_name,
              pat.mobile_number AS phone,
              pat.gender,
              EXTRACT(YEAR FROM age(pat.date_of_birth))::int AS age,
              a.token_number,
              (a.scheduled_start AT TIME ZONE 'Asia/Kolkata')::text AS scheduled_start,
              a.appointment_status,
              a.appointment_type,
              COALESCE(v.name, '') AS venue_name,
              COALESCE(a.notes, '') AS reason
       FROM appointments a
       JOIN users pat ON pat.id = a.patient_id
       LEFT JOIN venues v ON v.id = a.venue_id
       WHERE a.doctor_id = $1
         AND (a.scheduled_start AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2 AND $3
         AND a.deleted_at IS NULL
       ORDER BY a.scheduled_start`,
      [doctorId, from, to]
    );
    return result.rows;
  }

  async findVenueTypeStats(doctorId: string, from: string, to: string): Promise<Array<{
    venue_id: string;
    venue_name: string;
    appointment_type: string;
    count: number;
  }>> {
    const result = await pool.query(
      `SELECT
         v.id AS venue_id,
         COALESCE(v.name, 'Unknown') AS venue_name,
         a.appointment_type,
         COUNT(*)::int AS count
       FROM appointments a
       LEFT JOIN venues v ON v.id = a.venue_id
       WHERE a.doctor_id = $1
         AND (a.scheduled_start AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2 AND $3
         AND a.deleted_at IS NULL
       GROUP BY v.id, v.name, a.appointment_type
       ORDER BY v.name, count DESC`,
      [doctorId, from, to]
    );
    return result.rows;
  }
}
