import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import {
  seedClinic, seedUser, seedDoctorProfile, seedAppointmentSetting,
  seedTag, seedUserTag, generateMobile,
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
  const dy = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dy}T${hh}:${mm}:00+05:30`;
}

async function getUserTags(userId: string): Promise<any[]> {
  const r = await pool.query(
    `SELECT t.name FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = $1`,
    [userId]
  );
  return r.rows;
}

describe('POST /tags', () => {
  it('[happy] create custom tag with color; assign to patient', async () => {
    const clinicId = await seedClinic();
    const patient = await seedUser({ clinicId });

    const { accessToken } = await loginUser(clinicId, 'staff');

    const createRes = await request(app)
      .post(`${API}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'VIP', color: '#FF8800' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('VIP');
    expect(createRes.body.data.color).toBe('#FF8800');

    const assignRes = await request(app)
      .post(`${API}/users/${patient.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tag_id: createRes.body.data.id });

    expect(assignRes.status).toBe(201);

    const listRes = await request(app)
      .get(`${API}/users/${patient.id}/tags`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].name).toBe('VIP');
  });

  it('[validation] duplicate tag name per clinic → 409', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'staff');

    await seedTag(clinicId, { name: 'Duplicate' });

    const res = await request(app)
      .post(`${API}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Duplicate' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TAG_EXISTS');
  });

  it('[validation] invalid hex color → 400', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .post(`${API}/tags`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Bad', color: 'red' });

    expect(res.status).toBe(400);
  });
});

describe('Tag CRUD', () => {
  it('[happy] list, get, update, delete tag', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'staff');

    const tag = await seedTag(clinicId, { name: 'Follow-up' });

    const listRes = await request(app)
      .get(`${API}/tags`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    const getRes = await request(app)
      .get(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Follow-up');

    const patchRes = await request(app)
      .patch(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Follow-up Updated', color: '#00FF00' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('Follow-up Updated');
    expect(patchRes.body.data.color).toBe('#00FF00');

    const delRes = await request(app)
      .delete(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(delRes.status).toBe(200);

    const getRes2 = await request(app)
      .get(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes2.status).toBe(404);
  });

  it('[security] tags scoped to clinic', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const tag = await seedTag(clinicA, { name: 'Clinic-A-Only' });

    const { accessToken } = await loginUser(clinicB, 'staff');

    const getRes = await request(app)
      .get(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Hacked' });
    expect(patchRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`${API}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(delRes.status).toBe(404);
  });
});

describe('Auto-tag evaluation', () => {
  it('[unit] first booking → "New Patient"; subsequent → "Old Patient"', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const dow = ((new Date().getDay() + 6) % 7) + 1;
    await seedAppointmentSetting(doctor.id, { day_of_week: dow, start_time: '09:00', end_time: '10:00' });

    await seedTag(clinicId, {
      name: 'New Patient',
      is_auto: true,
      rule_definition: { type: 'appointment_count', operator: 'eq', value: 1 },
    });
    await seedTag(clinicId, {
      name: 'Old Patient',
      is_auto: true,
      rule_definition: { type: 'appointment_count', operator: 'gte', value: 2 },
    });

    const { user: patient, accessToken } = await loginUser(clinicId);

    const slot1 = futureIST(7, 9, 0);
    const res1 = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: slot1, idempotency_key: 'tag-test-1' });

    expect(res1.status).toBe(201);

    const tagsAfterFirst = await getUserTags(patient.id);
    const namesAfterFirst = tagsAfterFirst.map((r: any) => r.name);
    expect(namesAfterFirst).toContain('New Patient');
    expect(namesAfterFirst).not.toContain('Old Patient');

    const slot2 = futureIST(7, 9, 15);
    const res2 = await request(app)
      .post(`${API}/patient/book-slot`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doctor_id: doctor.id, scheduled_start: slot2, idempotency_key: 'tag-test-2' });

    expect(res2.status).toBe(201);

    const tagsAfterSecond = await getUserTags(patient.id);
    const namesAfterSecond = tagsAfterSecond.map((r: any) => r.name);
    expect(namesAfterSecond).not.toContain('New Patient');
    expect(namesAfterSecond).toContain('Old Patient');
  });
});
