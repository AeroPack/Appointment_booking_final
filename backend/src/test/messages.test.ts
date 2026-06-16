import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import {
  seedClinic, seedUser, seedDoctorProfile, seedVenue,
  seedAppointmentSetting, seedMessageTemplate, seedAppointment,
  seedMessage, generateMobile,
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

async function countMessages(appointmentId?: string): Promise<number> {
  if (appointmentId) {
    const r = await pool.query('SELECT COUNT(*)::int AS c FROM messages WHERE appointment_id = $1', [appointmentId]);
    return r.rows[0].c;
  }
  const r = await pool.query('SELECT COUNT(*)::int AS c FROM messages');
  return r.rows[0].c;
}

async function fetchMessages(appointmentId?: string): Promise<any[]> {
  if (appointmentId) {
    const r = await pool.query('SELECT * FROM messages WHERE appointment_id = $1 ORDER BY schedule_for', [appointmentId]);
    return r.rows;
  }
  const r = await pool.query('SELECT * FROM messages ORDER BY schedule_for');
  return r.rows;
}

// --------------------------------------------------------------------------
// POST /send-message
// --------------------------------------------------------------------------
describe('POST /send-message', () => {
  it('[happy] inserts pending row with rendered content (placeholders filled)', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor', name: 'Dr. Smith' });
    await seedDoctorProfile(doctor.id);
    const patient = await seedUser({ clinicId, name: 'John Doe' });
    const venue = await seedVenue(clinicId, { name: 'Main Clinic' });
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, venue_id: venue.id, start_time: '09:00', end_time: '10:00' });

    const slotStart = new Date();
    slotStart.setDate(slotStart.getDate() + 7);
    slotStart.setHours(9, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000);
    const appt = await seedAppointment({
      clinic_id: clinicId, doctor_id: doctor.id, patient_id: patient.id,
      booked_by_user_id: patient.id, scheduled_start: slotStart, scheduled_end: slotEnd,
      venue_id: venue.id, token_number: 1,
    });

    const tmpl = await seedMessageTemplate(clinicId, {
      template_type: 'booking_confirmation',
      content: 'Hello {{patient_name}}, your appointment with {{doctor_name}} at {{venue}} on {{slot_time}} is confirmed. Token: {{token_number}}',
    });

    const { accessToken } = await loginUser(clinicId, 'staff');
    const res = await request(app)
      .post(`${API}/send-message`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ template_id: tmpl.id, receiver_id: patient.id, appointment_id: appt.id });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'scheduled' });

    const msgs = await fetchMessages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toContain('Hello John Doe');
    expect(msgs[0].content).toContain('Dr. Smith');
    expect(msgs[0].content).toContain('Main Clinic');
    expect(msgs[0].content).toContain('Token: 1');
    expect(msgs[0].status).toBe('pending');
  });

  it('[validation] unknown template_id → 400', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'staff');
    const res = await request(app)
      .post(`${API}/send-message`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ template_id: '00000000-0000-0000-0000-000000000000', receiver_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('[security] patient role → 403', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'patient');
    const res = await request(app)
      .post(`${API}/send-message`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ template_id: '00000000-0000-0000-0000-000000000000', receiver_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(403);
  });
});

// --------------------------------------------------------------------------
// Reminder scheduling (integrated with booking)
// --------------------------------------------------------------------------
describe('Reminder scheduling on booking', () => {
  it('[unit] 3 reminders (1440/360/120 min) → schedule_for computed correctly from slot time', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor', name: 'Dr. A' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const slotTime = futureIST(7, 9, 0);
    const slotDate = new Date(slotTime);

    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 1440, content: 'Reminder 24h: {{slot_time}}' });
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 360, content: 'Reminder 6h: {{slot_time}}' });
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 120, content: 'Reminder 2h: {{slot_time}}' });

    const { accessToken } = await loginUser(clinicId);
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: slotTime, idempotency_key: 'msg-test-1' });

    expect(res.status).toBe(201);

    const msgs = await fetchMessages(res.body.data.id);
    expect(msgs.length).toBe(3);

    const expectedOffsets = [1440, 360, 120];
    for (let i = 0; i < 3; i++) {
      const expectedSchedule = new Date(slotDate.getTime() - expectedOffsets[i] * 60 * 1000);
      const actual = new Date(msgs[i].schedule_for);
      expect(actual.getTime()).toBeCloseTo(expectedSchedule.getTime(), -2);
      expect(msgs[i].status).toBe('pending');
      expect(msgs[i].content).toContain('Reminder');
    }
  });

  it('[edge] booking inside a reminder window skips already-past reminders', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor', name: 'Dr. B' });
    await seedDoctorProfile(doctor.id);

    const now = new Date();
    const nearFuture = new Date(now.getTime() + 15 * 60 * 1000);
    const nearFutureMin = nearFuture.getMinutes();
    nearFuture.setMinutes(Math.ceil(nearFutureMin / 15) * 15, 0, 0);
    const y = nearFuture.getFullYear();
    const mo = String(nearFuture.getMonth() + 1).padStart(2, '0');
    const d = String(nearFuture.getDate()).padStart(2, '0');
    const hh = String(nearFuture.getHours()).padStart(2, '0');
    const mm = String(nearFuture.getMinutes()).padStart(2, '0');
    const scheduledStart = `${y}-${mo}-${d}T${hh}:${mm}:00+05:30`;

    const dow = ((nearFuture.getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '00:00', end_time: '23:59' });

    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 30, content: '30min reminder' });
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 5, content: '5min reminder' });

    const { accessToken } = await loginUser(clinicId);
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: scheduledStart, idempotency_key: 'msg-test-2' });

    expect(res.status).toBe(201);

    const msgs = await fetchMessages(res.body.data.id);
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('5min reminder');
  });

  it('[edge] cancelReminders deletes pending messages for that appointment', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor', name: 'Dr. C' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    const slotTime = futureIST(7, 9, 0);
    await seedMessageTemplate(clinicId, { doctor_id: doctor.id, template_type: 'reminder', offset_minutes: 1440, content: 'Reminder' });

    const { accessToken } = await loginUser(clinicId);
    const res = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: slotTime, idempotency_key: 'msg-test-3' });

    expect(res.status).toBe(201);
    expect(await countMessages(res.body.data.id)).toBe(1);

    const { messagesService } = await import('../modules/messages/messages.controller.js');
    await messagesService.cancelReminders(res.body.data.id);

    expect(await countMessages(res.body.data.id)).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Delivery worker
// --------------------------------------------------------------------------
describe('Delivery worker', () => {
  it('[unit] picks only due pending rows', async () => {
    const clinicId = await seedClinic();
    const patient = await seedUser({ clinicId });

    const past = new Date(Date.now() - 60 * 60 * 1000);
    const future = new Date(Date.now() + 60 * 60 * 1000);

    await seedMessage({ receiver_id: patient.id, schedule_for: past, status: 'pending' });
    await seedMessage({ receiver_id: patient.id, schedule_for: future, status: 'pending' });
    await seedMessage({ receiver_id: patient.id, schedule_for: past, status: 'sent', sent_at: past });

    const { MessagesService } = await import('../modules/messages/messages.service.js');
    const { MessagesRepository } = await import('../modules/messages/messages.repository.js');
    const svc = new MessagesService(new MessagesRepository());

    const sent = await svc.processPending(10);
    expect(sent).toBe(1);

    const all = await fetchMessages();
    const sentMsgs = all.filter((m: any) => m.status === 'sent');
    expect(sentMsgs.length).toBe(2);
    expect(sentMsgs[0].id).toBe(all[0].id);
  });

  it('[edge] provider failure increments retry_count; after max retries marks failed', async () => {
    const clinicId = await seedClinic();
    const patient = await seedUser({ clinicId });

    const past = new Date(Date.now() - 60 * 1000);
    await seedMessage({ receiver_id: patient.id, schedule_for: past, status: 'pending', retry_count: 0 });
    await seedMessage({ receiver_id: patient.id, schedule_for: past, status: 'pending', retry_count: 2 });

    const { MessagesService } = await import('../modules/messages/messages.service.js');
    const { MessagesRepository } = await import('../modules/messages/messages.repository.js');
    const svc = new MessagesService(new MessagesRepository());

    jest.spyOn(svc, 'deliver').mockRejectedValue(new Error('Provider unreachable') as never);

    const sent = await svc.processPending(10);
    expect(sent).toBe(0);

    const all = await fetchMessages();
    const msg0 = all.find((m: any) => m.retry_count === 0 || m.retry_count === 1);
    const msg1 = all.find((m: any) => m.retry_count === 2 || m.retry_count === 3);

    expect(msg0.retry_count).toBe(1);
    expect(msg0.status).toBe('pending');

    expect(msg1.retry_count).toBe(3);
    expect(msg1.status).toBe('failed');
  });

  it('[edge] never double-sends already sent messages', async () => {
    const clinicId = await seedClinic();
    const patient = await seedUser({ clinicId });

    const past = new Date(Date.now() - 60 * 1000);
    await seedMessage({ receiver_id: patient.id, schedule_for: past, status: 'pending' });
    await seedMessage({ receiver_id: patient.id, schedule_for: past, status: 'sent' });

    const { MessagesService } = await import('../modules/messages/messages.service.js');
    const { MessagesRepository } = await import('../modules/messages/messages.repository.js');
    const svc = new MessagesService(new MessagesRepository());

    await svc.processPending(10);

    const all = await fetchMessages();
    const sentMsgs = all.filter((m: any) => m.status === 'sent');
    expect(sentMsgs.length).toBe(2);

    await svc.processPending(10);

    const all2 = await fetchMessages();
    const sentMsgs2 = all2.filter((m: any) => m.status === 'sent');
    expect(sentMsgs2.length).toBe(2);
  });
});
