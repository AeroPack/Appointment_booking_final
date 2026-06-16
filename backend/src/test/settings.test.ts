import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import {
  seedClinic, seedUser, seedDoctorProfile, seedVenue,
  seedAppointmentSetting, seedMessageTemplate, generateMobile,
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

describe('GET /appointment-setting', () => {
  it('[happy] single period returned', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    await seedAppointmentSetting(doctor.id, {
      day_of_week: 1, start_time: '09:00', end_time: '11:00',
    });
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/appointment-setting?doctor_id=${doctor.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.doctor_id).toBe(doctor.id);
    expect(res.body.data.periods.length).toBe(1);
    expect(res.body.data.periods[0].start_time).toBe('09:00');
    expect(res.body.data.periods[0].end_time).toBe('11:00');
  });

  it('[happy] split shift (two periods for same day)', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    await seedAppointmentSetting(doctor.id, { day_of_week: 1, start_time: '09:00', end_time: '11:00' });
    await seedAppointmentSetting(doctor.id, { day_of_week: 1, start_time: '17:00', end_time: '21:00' });
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/appointment-setting?doctor_id=${doctor.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.periods.length).toBe(2);
    expect(res.body.data.periods[0].start_time).toBe('09:00');
    expect(res.body.data.periods[1].start_time).toBe('17:00');
  });

  it('[happy] reminders returned sorted by offset', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    await seedAppointmentSetting(doctor.id);
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 120 });
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 1440 });
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/appointment-setting?doctor_id=${doctor.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reminders.length).toBe(2);
    expect(res.body.data.reminders[0].offset_minutes).toBe(120);
    expect(res.body.data.reminders[1].offset_minutes).toBe(1440);
  });

  it('[security] other clinic doctor → 404', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const doctor = await seedUser({ clinicId: clinicA, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicB);

    const res = await request(app)
      .get(`${API}/appointment-setting?doctor_id=${doctor.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /appointment-setting', () => {
  it('[happy] create multiple periods across days', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .put(`${API}/appointment-setting`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        doctor_id: doctor.id,
        periods: [
          { day_of_week: 1, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 15, max_patients_per_slot: 10 },
          { day_of_week: 3, start_time: '14:00', end_time: '17:00', slot_duration_minutes: 30, max_patients_per_slot: 5 },
        ],
        reminders: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.periods.length).toBe(2);
  });

  it('[validation] start_time >= end_time → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .put(`${API}/appointment-setting`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        doctor_id: doctor.id,
        periods: [
          { day_of_week: 1, start_time: '12:00', end_time: '09:00', slot_duration_minutes: 15, max_patients_per_slot: 10 },
        ],
        reminders: [],
      });

    expect(res.status).toBe(400);
  });

  it('[validation] day_of_week outside 1–7 → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .put(`${API}/appointment-setting`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        doctor_id: doctor.id,
        periods: [
          { day_of_week: 0, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 15, max_patients_per_slot: 10 },
        ],
        reminders: [],
      });

    expect(res.status).toBe(400);
  });

  it('[validation] slot_duration <= 0 → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .put(`${API}/appointment-setting`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        doctor_id: doctor.id,
        periods: [
          { day_of_week: 1, start_time: '09:00', end_time: '10:00', slot_duration_minutes: -5, max_patients_per_slot: 10 },
        ],
        reminders: [],
      });

    expect(res.status).toBe(400);
  });

  it('[edge] lowering capacity succeeds', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .put(`${API}/appointment-setting`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        doctor_id: doctor.id,
        periods: [
          { day_of_week: 1, start_time: '09:00', end_time: '10:00', slot_duration_minutes: 15, max_patients_per_slot: 3 },
        ],
        reminders: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.periods[0].max_patients_per_slot).toBe(3);
  });
});

describe('POST /message-templates', () => {
  it('[happy] create cancellation template', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .post(`${API}/message-templates`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        doctor_id: doctor.id,
        template_type: 'appointment_cancelled',
        subject: 'Appointment Cancelled',
        content: 'Dear {{patient_name}}, your appointment with {{doctor_name}} on {{slot_time}} has been cancelled.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.template_type).toBe('appointment_cancelled');
    expect(res.body.data.content).toContain('{{patient_name}}');
  });

  it('[validation] reminder requires offset → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .post(`${API}/message-templates`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        template_type: 'reminder',
        content: 'Reminder content',
      });

    expect(res.status).toBe(400);
  });

  it('[validation] event type with offset → 400', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .post(`${API}/message-templates`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        template_type: 'booking_confirmation',
        content: 'Confirmed!',
        offset_minutes: 60,
      });

    expect(res.status).toBe(400);
  });

  it('[security] patient role → 403', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'patient');

    const res = await request(app)
      .post(`${API}/message-templates`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        template_type: 'booking_confirmation',
        content: 'Confirmed!',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /message-templates', () => {
  it('[happy] list templates for doctor', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 1440 });
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'booking_confirmation' });
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/message-templates?doctor_id=${doctor.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });
});

describe('PATCH /message-templates/:id', () => {
  it('[happy] update content', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const template = await seedMessageTemplate(clinicId, { doctor_id: doctor.id });
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .patch(`${API}/message-templates/${template.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Updated content');
  });
});

describe('DELETE /message-templates/:id', () => {
  it('[happy] delete template', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const template = await seedMessageTemplate(clinicId, { doctor_id: doctor.id });
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .delete(`${API}/message-templates/${template.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`${API}/message-templates?doctor_id=${doctor.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.body.data.length).toBe(0);
  });

  it('[security] other clinic template → 404', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const doctor = await seedUser({ clinicId: clinicA, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const template = await seedMessageTemplate(clinicA, { doctor_id: doctor.id });
    const { accessToken } = await loginUser(clinicB, 'staff');

    const res = await request(app)
      .delete(`${API}/message-templates/${template.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});
