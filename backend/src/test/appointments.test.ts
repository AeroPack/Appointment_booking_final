import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import {
  seedClinic, seedUser, seedDoctorProfile, seedVenue,
  seedAppointmentSetting, seedAppointment, generateMobile,
} from './helpers.js';

const API = '/api';

async function loginUser(clinicId: string, role: 'doctor' | 'patient' | 'staff' = 'patient') {
  const mobile = generateMobile();
  const user = await seedUser({ clinicId, mobile, role });

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  await request(app).post('/api/auth/request-otp').send({ mobile_number: mobile });
  const logCall = consoleSpy.mock.calls[0][0] as string;
  const rawOtp = logCall.split(': ')[1];
  consoleSpy.mockRestore();

  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({ mobile_number: mobile, otp: rawOtp });

  return { user, accessToken: verifyRes.body.data.accessToken };
}

function futureDate(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function futureDateObj(daysFromNow = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(9, 0, 0, 0);
  return d;
}

function futureIST(daysFromNow = 7, hours = 9, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hours, minutes, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}:00+05:30`;
}

describe('GET /patient/find-slots', () => {
  it('[unit] period 09:00–10:00, 15-min slots → 4 slots at correct times', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    await seedAppointmentSetting(doctor.id, {
      day_of_week: ((new Date().getDay() + 6) % 7) + 1,
      start_time: '09:00', end_time: '10:00', slot_duration_minutes: 15,
    });
    const { accessToken } = await loginUser(clinicId);

    const date = futureDate();
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const day = res.body.data.days[0];
    expect(day.slots.length).toBe(4);
    expect(day.slots[0].start).toContain(`T09:00:00+05:30`);
    expect(day.slots[1].start).toContain(`T09:15:00+05:30`);
    expect(day.slots[2].start).toContain(`T09:30:00+05:30`);
    expect(day.slots[3].start).toContain(`T09:45:00+05:30`);
  });

  it('[unit] split shift → both blocks present, no slots in the gap', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '11:00' });
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '17:00', end_time: '19:00' });
    const { accessToken } = await loginUser(clinicId);

    const date = futureDate();
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const slots = res.body.data.days[0].slots;
    expect(slots.length).toBe(16); // 8 morning + 8 evening
    expect(slots[0].start).toContain('T09:00');
    expect(slots[7].start).toContain('T10:45');
    expect(slots[8].start).toContain('T17:00');
    expect(slots[15].start).toContain('T18:45');
  });

  it('[unit] booked_count counts only booked+finished; cancelled excluded', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const patient = await seedUser({ clinicId });
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const date = futureDate();
    const slotStart = futureDateObj();
    const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000);

    await seedAppointment({ clinic_id: clinicId, doctor_id: doctor.id, patient_id: patient.id, booked_by_user_id: patient.id, scheduled_start: slotStart, scheduled_end: slotEnd, appointment_status: 'booked' });
    await seedAppointment({ clinic_id: clinicId, doctor_id: doctor.id, patient_id: patient.id, booked_by_user_id: patient.id, scheduled_start: slotStart, scheduled_end: slotEnd, appointment_status: 'cancelled' });

    const { accessToken } = await loginUser(clinicId);
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const nineAm = res.body.data.days[0].slots.find((s: any) => s.start.includes('T09:00:00'));
    expect(nineAm.booked_count).toBe(1);
  });

  it('[unit] available = capacity − booked_count; is_full when count ≥ capacity', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const patient = await seedUser({ clinicId });
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00', max_patients_per_slot: 2 });

    const date = futureDate();
    const slotStart = futureDateObj();
    const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000);

    await seedAppointment({ clinic_id: clinicId, doctor_id: doctor.id, patient_id: patient.id, booked_by_user_id: patient.id, scheduled_start: slotStart, scheduled_end: slotEnd, appointment_status: 'booked' });

    const { accessToken } = await loginUser(clinicId);
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const nineAm = res.body.data.days[0].slots.find((s: any) => s.start.includes('T09:00:00'));
    expect(nineAm.capacity).toBe(2);
    expect(nineAm.booked_count).toBe(1);
    expect(nineAm.available).toBe(1);
    expect(nineAm.is_full).toBe(false);

    // Book a second to fill it
    const patient2 = await seedUser({ clinicId });
    await seedAppointment({ clinic_id: clinicId, doctor_id: doctor.id, patient_id: patient2.id, booked_by_user_id: patient2.id, scheduled_start: slotStart, scheduled_end: slotEnd, appointment_status: 'booked' });

    const res2 = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const nineAm2 = res2.body.data.days[0].slots.find((s: any) => s.start.includes('T09:00:00'));
    expect(nineAm2.booked_count).toBe(2);
    expect(nineAm2.available).toBe(0);
    expect(nineAm2.is_full).toBe(true);
  });

  it('[unit] doctor with no active setting for that weekday → empty slots', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId);

    const date = futureDate();
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.days[0].slots).toEqual([]);
  });

  it('[integration] date range spanning a week returns one entry per day', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    for (let dow = 1; dow <= 7; dow++) {
      await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });
    }
    const { accessToken } = await loginUser(clinicId);

    const from = futureDate(0);
    const to = futureDate(6);
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.days.length).toBe(7);
  });

  it('[edge] past date → empty slots', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow });
    const { accessToken } = await loginUser(clinicId);

    const pastDate = '2020-01-01';
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${pastDate}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.days[0].slots).toEqual([]);
  });

  it('[edge] range > 31 days → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId);

    const from = futureDate(0);
    const to = futureDate(60);
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RANGE_TOO_LARGE');
  });

  it('[edge] timezone: 09:00 IST serializes as +05:30', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });
    const { accessToken } = await loginUser(clinicId);

    const date = futureDate();
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.days[0].slots[0].start).toMatch(/\+05:30$/);
  });

  it('[security] doctor from another clinic → 404', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const doctor = await seedUser({ clinicId: clinicA, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicB);

    const date = futureDate();
    const res = await request(app)
      .get(`${API}/patient/find-slots?doctor_id=${doctor.id}&from=${date}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /patient/book-slot', () => {
  it('[happy] books a slot and returns 201 with booking details', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const patient = await seedUser({ clinicId });
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const scheduledStart = futureIST();
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${(await loginUser(clinicId)).accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: scheduledStart, idempotency_key: 'key-1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.doctor_id).toBe(doctor.id);
    expect(res.body.data.appointment_status).toBe('booked');
    expect(res.body.data.token_number).toBe(1);
    expect(res.body.data.venue).toBeNull();
  });

  it('[happy] idempotency: same key returns existing booking', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const { accessToken } = await loginUser(clinicId);
    const scheduledStart = futureIST();

    const res1 = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: scheduledStart, idempotency_key: 'key-2' });

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: scheduledStart, idempotency_key: 'key-2' });

    expect(res2.status).toBe(201);
    expect(res2.body.data.id).toBe(res1.body.data.id);
  });

  it('[security] patient_id override books for a dependent', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const parent = await seedUser({ clinicId });
    const dependent = await seedUser({ clinicId });
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const { accessToken } = await loginUser(clinicId);
    const scheduledStart = futureIST();

    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: scheduledStart, patient_id: dependent.id, idempotency_key: 'key-3' });

    expect(res.status).toBe(201);
    expect(res.body.data.patient_id).toBe(dependent.id);
  });

  it('[security] staff role → 403', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const staff = await seedUser({ clinicId, role: 'staff' });
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const { accessToken } = await loginUser(clinicId, 'staff');
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: futureIST(), idempotency_key: 'key-4' });

    expect(res.status).toBe(403);
  });

  it('[security] doctor from another clinic → 404', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const doctor = await seedUser({ clinicId: clinicA, role: 'doctor' });
    await seedDoctorProfile(doctor.id);

    const { accessToken } = await loginUser(clinicB);
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: futureIST(), idempotency_key: 'key-5' });

    expect(res.status).toBe(404);
  });

  it('[validation] past slot → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId);

    const past = '2020-01-01T09:00:00+05:30';
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: past, idempotency_key: 'key-6' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAST_SLOT');
  });

  it('[validation] no setting for weekday → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: futureIST(), idempotency_key: 'key-7' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_SETTING_FOR_DAY');
  });
});
