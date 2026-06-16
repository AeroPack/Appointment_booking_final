import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { runner } from 'node-pg-migrate';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOBILE = process.env.SEED_MOBILE || '9999999999';

interface DoctorSeed {
  name: string;
  mobile: string;
  speciality: string;
  qualification: string;
  title: string;
  consultation_fee: number;
  experience_years: number;
  bio: string;
}

interface VenueSeed {
  name: string;
  address: string;
  phone: string;
}

const DOCTORS: DoctorSeed[] = [
  {
    name: 'Dr. Rajat Mohan',
    mobile: '8888888801',
    speciality: 'Cardiologist',
    qualification: 'MBBS, MD, DM, FCSI',
    title: 'Senior Consultant Interventional Cardiologist',
    consultation_fee: 2000,
    experience_years: 25,
    bio: 'Dr. Rajat Mohan is a Senior Consultant Interventional Cardiologist at Sir Ganga Ram Hospital, New Delhi with over 25 years of experience in treating cardiac patients from India and abroad. He places great emphasis on preventive cardiology and is an active clinical cardiologist with vast experience in non-invasive and interventional cardiology. He performs a wide range of interventional procedures including a large number of Coronary Angioplasties (PTCA). Dr. Rajat Mohan is an acknowledged expert in cardiology and sees patients at Kiran Heart Centre in Karol Bagh.',
  },
  {
    name: 'Dr. James Wilson',
    mobile: '8888888802',
    speciality: 'Dermatologist',
    qualification: 'MD, DVD',
    title: 'Consultant Dermatologist',
    consultation_fee: 800,
    experience_years: 10,
    bio: 'Dr. James Wilson is a renowned dermatologist specializing in medical and cosmetic dermatology. His expertise includes acne treatment, psoriasis management, skin cancer screening, and aesthetic procedures. He believes in a holistic approach to skin health.',
  },
  {
    name: 'Dr. Priya Patel',
    mobile: '8888888803',
    speciality: 'Pediatrician',
    qualification: 'MD Pediatrics',
    title: 'Senior Pediatrician',
    consultation_fee: 600,
    experience_years: 8,
    bio: 'Dr. Priya Patel is a dedicated pediatrician with extensive experience in child healthcare. She provides comprehensive care from infancy through adolescence, including well-child visits, vaccinations, and management of acute and chronic childhood illnesses.',
  },
  {
    name: 'Dr. Michael Torres',
    mobile: '8888888804',
    speciality: 'Orthopedist',
    qualification: 'MS, DNB Ortho',
    title: 'Orthopedic Surgeon',
    consultation_fee: 1200,
    experience_years: 12,
    bio: 'Dr. Michael Torres is an experienced orthopedic surgeon specializing in sports medicine, joint replacement, and trauma surgery. He has successfully performed over 2,000 surgeries and is dedicated to helping patients regain mobility and return to an active lifestyle.',
  },
  {
    name: 'Dr. Aisha Rahman',
    mobile: '8888888805',
    speciality: 'Ophthalmologist',
    qualification: 'MS Ophthalmology',
    title: 'Consultant Ophthalmologist',
    consultation_fee: 700,
    experience_years: 9,
    bio: 'Dr. Aisha Rahman is a skilled ophthalmologist specializing in cataract surgery, glaucoma management, and refractive procedures. She is passionate about preserving vision and uses the latest technology to deliver optimal outcomes for her patients.',
  },
];

const VENUES: VenueSeed[] = [
  { name: 'Kiran Heart Centre', address: 'U-2, Prasad Nagar, Karol Bagh, Opp. Prasad Nagar Police Station, Delhi 110060', phone: '011-25720771' },
  { name: 'Sir Ganga Ram Hospital Pvt. OPD', address: 'F-24, First Floor, Ganga Ram Hospital, Rajinder Nagar, Delhi 110060, Room No. 16, Ground floor, Echo Lab', phone: '+91-8527684291' },
];

async function seed() {
  console.log('Seeding database...');

  // Drop all tables so schema.sql recreates them fresh (handles column additions)
  await pool.query(`
    DROP TABLE IF EXISTS
      appointment_status_history,
      appointments,
      booking_idempotency,
      appointment_settings,
      venues,
      user_tags,
      tags,
      messages,
      message_templates,
      refresh_tokens,
      otps,
      doctor_profiles,
      users,
      clinics
    CASCADE
  `);
  console.log('Tables dropped (will be recreated from schema)');

  // Run schema
  const schemaPath = resolve(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
  console.log('Schema applied');

  // Run pending migrations (safety net for existing databases)
  {
    const client = await pool.connect();
    try {
      await runner({
        dbClient: client,
        dir: resolve(__dirname, '../../migrations'),
        migrationsTable: 'schema_migrations',
        direction: 'up',
        count: Infinity,
      });
      console.log('Migrations applied');
    } finally {
      client.release();
    }
  }

  // Clear existing seed data (idempotent re-runs)
  await pool.query(`
    TRUNCATE TABLE
      appointment_status_history,
      appointments,
      booking_idempotency,
      appointment_settings,
      venues,
      user_tags,
      tags,
      messages,
      message_templates,
      refresh_tokens,
      otps,
      doctor_profiles,
      users,
      clinics
    CASCADE
  `);
  console.log('Existing data cleared');

  // Clinic
  const clinic = await pool.query(
    `INSERT INTO clinics (name) VALUES ('Rajat Mohan Hospital Clinic') RETURNING id`
  );
  const clinicId = clinic.rows[0].id;
  console.log('Clinic created:', clinicId);

  // Patient
  const patient = await pool.query(
    `INSERT INTO users (clinic_id, name, mobile_number, role, is_verified)
     VALUES ($1, 'Test Patient', $2, 'patient', true) RETURNING id`,
    [clinicId, MOBILE]
  );
  console.log('Patient created:', patient.rows[0].id, 'mobile:', MOBILE);
  const patientId = patient.rows[0].id;

  // Staff
  const staff = await pool.query(
    `INSERT INTO users (clinic_id, name, mobile_number, role, is_verified)
     VALUES ($1, 'Test Staff', '7777777777', 'staff', true) RETURNING id`,
    [clinicId]
  );
  console.log('Staff created:', staff.rows[0].id);

  // ---- Venues ----
  const venueIds: string[] = [];
  for (const v of VENUES) {
    const result = await pool.query(
      `INSERT INTO venues (clinic_id, name, address, phone)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [clinicId, v.name, v.address, v.phone]
    );
    venueIds.push(result.rows[0].id);
    console.log(`Venue created: ${v.name} (${result.rows[0].id})`);
  }

  // ---- Doctors ----
  const doctorIds: string[] = [];
  for (const doc of DOCTORS) {
    const userResult = await pool.query(
      `INSERT INTO users (clinic_id, name, mobile_number, role, is_verified)
       VALUES ($1, $2, $3, 'doctor', true) RETURNING id`,
      [clinicId, doc.name, doc.mobile]
    );
    const docId = userResult.rows[0].id;
    doctorIds.push(docId);

    await pool.query(
      `INSERT INTO doctor_profiles (user_id, speciality, qualification, title, consultation_fee, experience_years, bio, patient_count, awards_count, publications_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [docId, doc.speciality, doc.qualification, doc.title, doc.consultation_fee, doc.experience_years, doc.bio, Math.floor(Math.random() * 5000) + 500, Math.floor(Math.random() * 8) + 1, Math.floor(Math.random() * 15) + 1]
    );
    console.log(`Doctor created: ${doc.name} (${docId})`);
  }

  // ---- Appointment Settings ----
  // Different schedules per doctor for variety
  const schedules: { doctorIdx: number; days: number[]; venueIdx: number; start: string; end: string; duration: number; max: number }[] = [
    // Dr. Rajat Mohan — Mon-Fri, Kiran Heart Centre (morning) + Sir Ganga Ram (afternoon)
    { doctorIdx: 0, days: [1, 2, 3, 4, 5], venueIdx: 0, start: '09:00', end: '13:00', duration: 30, max: 2 },
    { doctorIdx: 0, days: [1, 3, 5], venueIdx: 1, start: '14:00', end: '17:00', duration: 30, max: 2 },
    // Dr. James Wilson — Mon-Sat, Kiran Heart Centre
    { doctorIdx: 1, days: [1, 2, 3, 4, 5, 6], venueIdx: 0, start: '10:00', end: '16:00', duration: 20, max: 3 },
    // Dr. Priya Patel — Tue-Sat, Sir Ganga Ram
    { doctorIdx: 2, days: [2, 3, 4, 5, 6], venueIdx: 1, start: '09:00', end: '15:00', duration: 15, max: 4 },
    // Dr. Michael Torres — Mon-Fri, Kiran Heart Centre
    { doctorIdx: 3, days: [1, 2, 3, 4, 5], venueIdx: 0, start: '08:00', end: '17:00', duration: 30, max: 2 },
    // Dr. Aisha Rahman — Mon-Fri, Sir Ganga Ram
    { doctorIdx: 4, days: [1, 2, 3, 4, 5], venueIdx: 1, start: '10:00', end: '18:00', duration: 20, max: 3 },
  ];

  for (const s of schedules) {
    for (const day of s.days) {
      await pool.query(
        `INSERT INTO appointment_settings (doctor_id, venue_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients_per_slot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [doctorIds[s.doctorIdx], venueIds[s.venueIdx], day, s.start, s.end, s.duration, s.max]
      );
    }
  }
  console.log('Appointment settings created');

  // Helper: create an ISO date string relative to today
  const dateOffset = (daysOffset: number, hour: number, minute: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const makeAppointment = async (doctorIdx: number, daysOffset: number, hour: number, minute: number, status: string, token: number, venueIdx?: number) => {
    const start = dateOffset(daysOffset, hour, minute);
    const end = dateOffset(daysOffset, hour, minute + 30);
    const vid = venueIdx !== undefined ? venueIds[venueIdx] : venueIds[0];
    const apt = await pool.query(
      `INSERT INTO appointments (clinic_id, doctor_id, patient_id, booked_by_user_id, venue_id, scheduled_start, scheduled_end, token_number, appointment_status)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [clinicId, doctorIds[doctorIdx], patientId, vid, start, end, token, status]
    );
    return apt.rows[0].id;
  };

  const insertHistory = async (appointmentId: string, oldStatus: string, newStatus: string, changedById: string) => {
    await pool.query(
      `INSERT INTO appointment_status_history (appointment_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [appointmentId, oldStatus, newStatus, changedById]
    );
  };

  // ---- Appointments ----
  // All appointments use unique hour/minute combos to avoid violating
  // uniq_patient_per_slot (same patient can't have two appointments at same scheduled_start).
  // Today's appointments (for dashboard)
  const todayAppts = [
    { doctorIdx: 0, hour: 9, minute: 0, status: 'booked', token: 1, venueIdx: 0 },
    { doctorIdx: 0, hour: 9, minute: 30, status: 'booked', token: 2, venueIdx: 0 },
    { doctorIdx: 0, hour: 10, minute: 0, status: 'finished', token: 3, venueIdx: 0 },
    { doctorIdx: 0, hour: 14, minute: 0, status: 'booked', token: 1, venueIdx: 1 },
    { doctorIdx: 1, hour: 11, minute: 0, status: 'booked', token: 1, venueIdx: 0 },
    { doctorIdx: 1, hour: 11, minute: 20, status: 'finished', token: 2, venueIdx: 0 },
    { doctorIdx: 1, hour: 12, minute: 0, status: 'no_show', token: 3, venueIdx: 0 },
    { doctorIdx: 2, hour: 15, minute: 0, status: 'booked', token: 1, venueIdx: 1 },
    { doctorIdx: 2, hour: 15, minute: 15, status: 'booked', token: 2, venueIdx: 1 },
    { doctorIdx: 3, hour: 8, minute: 0, status: 'finished', token: 1, venueIdx: 0 },
    { doctorIdx: 4, hour: 16, minute: 0, status: 'booked', token: 1, venueIdx: 2 },
  ];

  for (const a of todayAppts) {
    const aptId = await makeAppointment(a.doctorIdx, 0, a.hour, a.minute, a.status, a.token, a.venueIdx);
    if (a.status === 'finished' || a.status === 'no_show') {
      await insertHistory(aptId, 'booked', a.status, doctorIds[a.doctorIdx]);
    }
  }
  console.log(`Today's appointments created (${todayAppts.length})`);

  // Past appointments
  const pastAppts = [
    { doctorIdx: 0, daysOffset: -1, hour: 10, minute: 0, status: 'finished', token: 1 },
    { doctorIdx: 0, daysOffset: -1, hour: 14, minute: 0, status: 'finished', token: 1 },
    { doctorIdx: 1, daysOffset: -2, hour: 11, minute: 0, status: 'finished', token: 1 },
    { doctorIdx: 1, daysOffset: -2, hour: 14, minute: 0, status: 'cancelled', token: 2 },
    { doctorIdx: 2, daysOffset: -1, hour: 11, minute: 0, status: 'finished', token: 1 },
    { doctorIdx: 3, daysOffset: -3, hour: 9, minute: 0, status: 'finished', token: 1 },
    { doctorIdx: 4, daysOffset: -2, hour: 14, minute: 0, status: 'finished', token: 1 },
    { doctorIdx: 4, daysOffset: -1, hour: 15, minute: 0, status: 'no_show', token: 1 },
    { doctorIdx: 0, daysOffset: -3, hour: 11, minute: 0, status: 'cancelled', token: 1 },
  ];

  for (const a of pastAppts) {
    const aptId = await makeAppointment(a.doctorIdx, a.daysOffset, a.hour, a.minute, a.status, a.token);
    if (a.status === 'finished' || a.status === 'cancelled' || a.status === 'no_show') {
      const changedBy = a.status === 'cancelled' ? patientId : doctorIds[a.doctorIdx];
      await insertHistory(aptId, 'booked', a.status, changedBy);
    }
  }
  console.log('Past appointments created');

  // Future appointments
  const futureAppts = [
    { doctorIdx: 0, daysOffset: 1, hour: 9, minute: 0, status: 'booked', token: 1 },
    { doctorIdx: 0, daysOffset: 1, hour: 9, minute: 30, status: 'booked', token: 2 },
    { doctorIdx: 1, daysOffset: 2, hour: 11, minute: 0, status: 'booked', token: 1 },
    { doctorIdx: 2, daysOffset: 1, hour: 15, minute: 0, status: 'booked', token: 1 },
    { doctorIdx: 3, daysOffset: 3, hour: 8, minute: 0, status: 'booked', token: 1 },
    { doctorIdx: 4, daysOffset: 2, hour: 14, minute: 0, status: 'booked', token: 1 },
  ];

  for (const a of futureAppts) {
    await makeAppointment(a.doctorIdx, a.daysOffset, a.hour, a.minute, a.status, a.token);
  }
  console.log('Future appointments created');

  console.log('\nDone! You can log in with mobile:', MOBILE);
  console.log('OTP will be printed in the backend console.\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
