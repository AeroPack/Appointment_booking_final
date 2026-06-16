import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { seedClinic, seedUser, generateMobile } from './helpers.js';
import { verifyToken } from '../utils/hash.js';

const API = '/api/auth';

describe('POST /auth/request-otp', () => {
  it('[happy] valid mobile → 200, OTP row created with hashed value', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: mobile });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('OTP sent to mobile');
    expect(res.body.data.expires_in).toBe(300);

    const otpRow = await pool.query(
      'SELECT * FROM otps WHERE mobile_number = $1',
      [mobile]
    );
    expect(otpRow.rows.length).toBe(1);
    expect(otpRow.rows[0].used).toBe(false);
    expect(otpRow.rows[0].otp_hash).not.toBeNull();
    expect(otpRow.rows[0].attempts).toBe(0);

    const logCall = consoleSpy.mock.calls[0][0] as string;
    const rawOtp = logCall.split(': ')[1];
    expect(rawOtp).toMatch(/^\d{6}$/);
    expect(verifyToken(rawOtp, otpRow.rows[0].otp_hash)).toBe(true);

    consoleSpy.mockRestore();
  });

  it('[validation] empty mobile → 400', async () => {
    const res = await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('[validation] missing mobile → 400', async () => {
    const res = await request(app)
      .post(`${API}/request-otp`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('[security] repeated requests → 429 after threshold', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile });

    const requests = Array(6).fill(null).map(() =>
      request(app).post(`${API}/request-otp`).send({ mobile_number: mobile })
    );

    const results = await Promise.all(requests);
    const statuses = results.map(r => r.status);
    const tooMany = statuses.filter(s => s === 429);
    expect(tooMany.length).toBeGreaterThanOrEqual(1);
  });

  it('[edge] re-request invalidates prior unused OTP', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile });

    await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: mobile });

    await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: mobile });

    const otpRows = await pool.query(
      'SELECT * FROM otps WHERE mobile_number = $1 ORDER BY created_at ASC',
      [mobile]
    );

    expect(otpRows.rows.length).toBe(2);
    expect(otpRows.rows[0].used).toBe(true);
    expect(otpRows.rows[1].used).toBe(false);
  });

  it('[edge] unknown mobile → 404', async () => {
    const res = await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: '9999999999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('POST /auth/verify-otp', () => {
  async function setupOtpScenario() {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: mobile });

    const logCall = consoleSpy.mock.calls[0][0] as string;
    const rawOtp = logCall.split(': ')[1];
    consoleSpy.mockRestore();

    return { mobile, rawOtp };
  }

  it('[happy] correct OTP → 200, tokens returned, OTP marked used', async () => {
    const { mobile, rawOtp } = await setupOtpScenario();

    const res = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.mobile_number).toBe(mobile);

    const otpRow = await pool.query(
      'SELECT * FROM otps WHERE mobile_number = $1',
      [mobile]
    );
    expect(otpRow.rows[0].used).toBe(true);
  });

  it('[edge] wrong OTP → 401, attempts incremented', async () => {
    const { mobile } = await setupOtpScenario();

    const res = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_OTP');

    const otpRow = await pool.query(
      'SELECT * FROM otps WHERE mobile_number = $1',
      [mobile]
    );
    expect(otpRow.rows[0].attempts).toBe(1);
  });

  it('[security] after N failed attempts → locked', async () => {
    const { mobile } = await setupOtpScenario();

    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post(`${API}/verify-otp`)
        .send({ mobile_number: mobile, otp: '000000' });
      if (i < 5) {
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_OTP');
      } else {
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('OTP_LOCKED');
      }
    }
  });

  it('[edge] expired OTP → 401', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: mobile });

    const logCall = consoleSpy.mock.calls[0][0] as string;
    const rawOtp = logCall.split(': ')[1];
    consoleSpy.mockRestore();

    await pool.query(
      'UPDATE otps SET expires_at = NOW() - INTERVAL \'1 second\' WHERE mobile_number = $1',
      [mobile]
    );

    const res = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('[edge] already-used OTP → 401', async () => {
    const { mobile, rawOtp } = await setupOtpScenario();

    // First use - succeeds
    await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    // Second use with same OTP - the OTP is already marked used
    const res = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_USED');
  });

  it('[validation] missing fields → 400', async () => {
    const res = await request(app)
      .post(`${API}/verify-otp`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('[validation] otp not 6 chars → 400', async () => {
    const mobile = generateMobile();
    const res = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: '12345' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  async function setupTokens() {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    const user = await seedUser({ clinicId, mobile });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post(`${API}/request-otp`).send({ mobile_number: mobile });
    const logCall = consoleSpy.mock.calls[0][0] as string;
    const rawOtp = logCall.split(': ')[1];
    consoleSpy.mockRestore();

    const verifyRes = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    return {
      accessToken: verifyRes.body.data.accessToken,
      refreshToken: verifyRes.body.data.refreshToken,
      user,
    };
  }

  it('[happy] valid token → new pair, old revoked', async () => {
    const { refreshToken } = await setupTokens();

    const res = await request(app)
      .post(`${API}/refresh`)
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('[security] reuse of revoked token → 401', async () => {
    const { refreshToken } = await setupTokens();

    await request(app)
      .post(`${API}/refresh`)
      .send({ refresh_token: refreshToken });

    const res = await request(app)
      .post(`${API}/refresh`)
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REUSED');
  });

  it('[edge] invalid token → 401', async () => {
    const res = await request(app)
      .post(`${API}/refresh`)
      .send({ refresh_token: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  async function setupLoggedInUser() {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post(`${API}/request-otp`).send({ mobile_number: mobile });
    const logCall = consoleSpy.mock.calls[0][0] as string;
    const rawOtp = logCall.split(': ')[1];
    consoleSpy.mockRestore();

    const verifyRes = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    return {
      accessToken: verifyRes.body.data.accessToken,
      refreshToken: verifyRes.body.data.refreshToken,
    };
  }

  it('[happy] logout revokes refresh token', async () => {
    const { accessToken, refreshToken } = await setupLoggedInUser();

    await request(app)
      .post(`${API}/logout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refresh_token: refreshToken })
      .expect(200);

    const res = await request(app)
      .post(`${API}/refresh`)
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('[security] no token → 401', async () => {
    const res = await request(app).get(`${API}/me`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('[security] invalid token → 401', async () => {
    const res = await request(app)
      .get(`${API}/me`)
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('[happy] returns current user', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    const user = await seedUser({ clinicId, mobile, role: 'patient', name: 'Test Patient' });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post(`${API}/request-otp`).send({ mobile_number: mobile });
    const logCall = consoleSpy.mock.calls[0][0] as string;
    const rawOtp = logCall.split(': ')[1];
    consoleSpy.mockRestore();

    const verifyRes = await request(app)
      .post(`${API}/verify-otp`)
      .send({ mobile_number: mobile, otp: rawOtp });

    const accessToken = verifyRes.body.data.accessToken;

    const res = await request(app)
      .get(`${API}/me`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.name).toBe('Test Patient');
  });
});
