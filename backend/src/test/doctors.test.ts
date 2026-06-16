import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import { seedClinic, seedUser, seedDoctorProfile, seedVenue, generateMobile } from './helpers.js';

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

describe('GET /doctors/:doctorId/profile', () => {
  it('[happy] returns doctor profile with speciality and fee', async () => {
    const clinicId = await seedClinic();
    const doctor = await seedUser({ clinicId, role: 'doctor', name: 'Dr. Test' });
    await seedDoctorProfile(doctor.id, {
      speciality: 'Cardiology',
      consultation_fee: 1000,
    });
    const { accessToken } = await loginUser(clinicId);

    const res = await request(app)
      .get(`${API}/doctors/${doctor.id}/profile`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Dr. Test');
    expect(res.body.data.speciality).toBe('Cardiology');
    expect(res.body.data.consultation_fee).toBe('1000.00');
  });

  it('[security] doctor from another clinic → 404', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const doctor = await seedUser({ clinicId: clinicA, role: 'doctor' });
    await seedDoctorProfile(doctor.id);
    const { accessToken } = await loginUser(clinicB);

    const res = await request(app)
      .get(`${API}/doctors/${doctor.id}/profile`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DOCTOR_NOT_FOUND');
  });
});

describe('POST /venues', () => {
  it('[happy] staff creates venue', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .post(`${API}/venues`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Main Clinic', address: '123 Main St' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Main Clinic');
    expect(res.body.data.clinic_id).toBe(clinicId);
  });

  it('[security] patient role → 403', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId, 'patient');

    const res = await request(app)
      .post(`${API}/venues`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Should Not Work' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /venues', () => {
  it('[happy] returns venues within clinic', async () => {
    const clinicId = await seedClinic();
    const { accessToken } = await loginUser(clinicId);
    await seedVenue(clinicId, { name: 'Venue A' });
    await seedVenue(clinicId, { name: 'Venue B' });

    const res = await request(app)
      .get(`${API}/venues`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.map((v: any) => v.name).sort()).toEqual(['Venue A', 'Venue B']);
  });
});

describe('PATCH /venues/:id', () => {
  it('[happy] update venue name', async () => {
    const clinicId = await seedClinic();
    const venue = await seedVenue(clinicId, { name: 'Old Name' });
    const { accessToken } = await loginUser(clinicId, 'staff');

    const res = await request(app)
      .patch(`${API}/venues/${venue.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('[security] other clinic venue → 404', async () => {
    const clinicA = await seedClinic();
    const clinicB = await seedClinic();
    const venue = await seedVenue(clinicA);
    const { accessToken } = await loginUser(clinicB, 'staff');

    const res = await request(app)
      .patch(`${API}/venues/${venue.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(404);
  });
});
