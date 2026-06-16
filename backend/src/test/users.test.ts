import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { seedClinic, seedUser, generateMobile } from './helpers.js';

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

  return {
    user,
    accessToken: verifyRes.body.data.accessToken,
  };
}

describe('GET /users/me', () => {
  it('[security] no token → 401', async () => {
    const res = await request(app).get(`${API}/users/me`);
    expect(res.status).toBe(401);
  });

  it('[happy] returns profile', async () => {
    const clinicId = await seedClinic();
    const { user, accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.name).toBe('Test User');
  });
});

describe('PATCH /users/me', () => {
  it('[happy] update name', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .patch(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('[security] clinic_id in body is silently ignored (stripped by zod)', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);

    // Only forbidden field in body → empty after strip → NO_FIELDS
    const res = await request(app)
      .patch(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ clinic_id: 'some-other-clinic' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FIELDS');
  });

  it('[security] clinic_id in body with valid fields is ignored', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .patch(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'New Name', clinic_id: 'some-other-clinic' });

    // clinic_id is stripped, name update goes through
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
    expect(res.body.data.clinic_id).toBe(clinicId);
  });

  it('[security] role in body is silently ignored', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .patch(`${API}/users/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'doctor' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FIELDS');
  });
});

describe('POST /users/dependents', () => {
  it('[happy] creates dependent linked to caller', async () => {
    const clinicId = await seedClinic();
    const { user, accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .post(`${API}/users/dependents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Child Name' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Child Name');
    expect(res.body.data.parent_user_id).toBe(user.id);
    expect(res.body.data.role).toBe('patient');
    expect(res.body.data.clinic_id).toBe(clinicId);
  });

  it('[validation] missing name → 400', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .post(`${API}/users/dependents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /users/dependents', () => {
  it('[happy] returns own dependents', async () => {
    const clinicId = await seedClinic();
    const { user, accessToken } = await loginUser(clinicId);

    await request(app)
      .post(`${API}/users/dependents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Dependent One' });

    await request(app)
      .post(`${API}/users/dependents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Dependent Two' });

    const res = await request(app)
      .get(`${API}/users/dependents`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.every((d: any) => d.parent_user_id === user.id)).toBe(true);
  });

  it('[happy] empty list when none', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/users/dependents`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
