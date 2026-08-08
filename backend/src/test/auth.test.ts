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

  it('[edge] unknown mobile → 200, auto-creates a patient (patients have no signup step)', async () => {
    const res = await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: '9199999999999' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const userRow = await pool.query(
      'SELECT role, is_verified FROM users WHERE mobile_number = $1',
      ['9199999999999']
    );
    expect(userRow.rows[0].role).toBe('patient');
    expect(userRow.rows[0].is_verified).toBe(false);
  });

  it('[security] doctor account → 400 USE_PASSWORD_LOGIN, no code sent', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile, role: 'doctor' });

    const res = await request(app)
      .post(`${API}/request-otp`)
      .send({ mobile_number: mobile });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USE_PASSWORD_LOGIN');
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

describe('POST /auth/register', () => {
  /** Register, capturing the code from the trace log the way OTP tests already do. */
  async function registerAndCaptureOtp(mobile: string, overrides: Partial<{ name: string; password: string }> = {}) {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = await request(app)
      .post(`${API}/register`)
      .send({
        name: overrides.name ?? 'Dr Test',
        mobile_number: mobile,
        password: overrides.password ?? 'Test@1122',
      });
    const rawOtp = (consoleSpy.mock.calls[0]?.[0] as string | undefined)?.split(': ')[1];
    consoleSpy.mockRestore();
    return { res, rawOtp };
  }

  it('[happy] valid signup → 201, doctor + clinic created, code sent', async () => {
    const mobile = generateMobile();
    const { res, rawOtp } = await registerAndCaptureOtp(mobile);

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBeDefined();
    expect(rawOtp).toMatch(/^\d{6}$/);

    const userRow = await pool.query(
      'SELECT role, is_verified, clinic_id FROM users WHERE mobile_number = $1',
      [mobile]
    );
    expect(userRow.rows[0].role).toBe('doctor');
    expect(userRow.rows[0].is_verified).toBe(false);

    const clinicRow = await pool.query('SELECT id FROM clinics WHERE id = $1', [userRow.rows[0].clinic_id]);
    expect(clinicRow.rows.length).toBe(1);
  });

  it('[validation] weak password → 400', async () => {
    const res = await request(app)
      .post(`${API}/register`)
      .send({ name: 'Dr Weak', mobile_number: generateMobile(), password: 'alllowercase' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('[edge] number already used by a verified account → 409 USER_EXISTS', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile, role: 'patient' }); // seedUser rows are always is_verified: true

    const res = await request(app)
      .post(`${API}/register`)
      .send({ name: 'Claim Attempt', mobile_number: mobile, password: 'Test@1122' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  it('[security] number held by an unverified patient shell → 409 IDENTIFIER_IN_USE, not silently promoted', async () => {
    const mobile = generateMobile();
    // Requesting a login code auto-creates an unverified patient shell.
    await request(app).post(`${API}/request-otp`).send({ mobile_number: mobile });

    const res = await request(app)
      .post(`${API}/register`)
      .send({ name: 'Takeover Attempt', mobile_number: mobile, password: 'Test@1122' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDENTIFIER_IN_USE');

    const userRow = await pool.query('SELECT role, password_hash FROM users WHERE mobile_number = $1', [mobile]);
    expect(userRow.rows[0].role).toBe('patient');
    expect(userRow.rows[0].password_hash).toBeNull();
  });

  it('[edge] retrying an unverified signup reclaims the same account and clinic, not a second one', async () => {
    const mobile = generateMobile();
    const first = await registerAndCaptureOtp(mobile, { name: 'First Try' });
    const firstUserId = first.res.body.data.user_id;
    const firstClinic = (await pool.query('SELECT clinic_id FROM users WHERE id = $1', [firstUserId])).rows[0].clinic_id;

    const second = await registerAndCaptureOtp(mobile, { name: 'Retry', password: 'Different@12' });

    expect(second.res.status).toBe(201);
    expect(second.res.body.data.user_id).toBe(firstUserId);

    const rows = await pool.query('SELECT clinic_id FROM users WHERE mobile_number = $1', [mobile]);
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].clinic_id).toBe(firstClinic);
  });
});

describe('POST /auth/login-password', () => {
  async function registerAndVerifyDoctor(mobile: string, password = 'Test@1122') {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const registerRes = await request(app)
      .post(`${API}/register`)
      .send({ name: 'Dr Login', mobile_number: mobile, password });
    const rawOtp = (consoleSpy.mock.calls[0][0] as string).split(': ')[1];
    consoleSpy.mockRestore();

    await request(app)
      .post(`${API}/verify-registration-otp`)
      .send({ user_id: registerRes.body.data.user_id, otp: rawOtp });

    return registerRes.body.data.user_id;
  }

  it('[happy] correct credentials → 200 with tokens', async () => {
    const mobile = generateMobile();
    await registerAndVerifyDoctor(mobile, 'Test@1122');

    const res = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'Test@1122' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('doctor');
  });

  it('[edge] wrong password → 401 INVALID_PASSWORD', async () => {
    const mobile = generateMobile();
    await registerAndVerifyDoctor(mobile, 'Test@1122');

    const res = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'WrongPass@1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('[security] patient account → 400 USE_OTP_LOGIN', async () => {
    const clinicId = await seedClinic();
    const mobile = generateMobile();
    await seedUser({ clinicId, mobile, role: 'patient' });

    const res = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'anything' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USE_OTP_LOGIN');
  });

  it('[security] unverified doctor → 403 ACCOUNT_UNVERIFIED, cannot skip the OTP step', async () => {
    const mobile = generateMobile();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app)
      .post(`${API}/register`)
      .send({ name: 'Dr Unverified', mobile_number: mobile, password: 'Test@1122' });
    consoleSpy.mockRestore();

    const res = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'Test@1122' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_UNVERIFIED');
  });
});

describe('Password reset flow', () => {
  async function registerAndVerifyDoctor(mobile: string, password: string) {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const registerRes = await request(app)
      .post(`${API}/register`)
      .send({ name: 'Dr Reset', mobile_number: mobile, password });
    const registerOtp = (consoleSpy.mock.calls[0][0] as string).split(': ')[1];
    consoleSpy.mockRestore();

    await request(app)
      .post(`${API}/verify-registration-otp`)
      .send({ user_id: registerRes.body.data.user_id, otp: registerOtp });
  }

  async function requestResetOtp(mobile: string): Promise<string> {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post(`${API}/forgot-password`).send({ mobile_number: mobile });
    const rawOtp = (consoleSpy.mock.calls[0][0] as string).split(': ')[1];
    consoleSpy.mockRestore();
    return rawOtp;
  }

  it('[happy] full cycle: request → verify → reset → login with the new password', async () => {
    const mobile = generateMobile();
    await registerAndVerifyDoctor(mobile, 'OldPass@11');

    const otp = await requestResetOtp(mobile);

    const verifyRes = await request(app)
      .post(`${API}/verify-password-reset-otp`)
      .send({ mobile_number: mobile, otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.valid).toBe(true);

    const resetRes = await request(app)
      .post(`${API}/reset-password`)
      .send({ mobile_number: mobile, otp, new_password: 'NewPass@22' });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'OldPass@11' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'NewPass@22' });
    expect(newLogin.status).toBe(200);
  });

  it('[security] unknown or password-less contact → same 200 shape (no account-enumeration oracle)', async () => {
    const knownMobile = generateMobile();
    await registerAndVerifyDoctor(knownMobile, 'Test@1122');
    const knownRes = await request(app).post(`${API}/forgot-password`).send({ mobile_number: knownMobile });

    const unknownRes = await request(app)
      .post(`${API}/forgot-password`)
      .send({ mobile_number: generateMobile() });

    // The fields a real (production) client ever sees must be identical either
    // way. __dev_otp is a non-production debug echo and necessarily differs -
    // there is no code to echo for a contact with nothing to reset - so it is
    // excluded here rather than being the thing under test.
    expect(unknownRes.status).toBe(knownRes.status);
    expect(unknownRes.body.data.message).toBe(knownRes.body.data.message);
    expect(unknownRes.body.data.expires_in).toBe(knownRes.body.data.expires_in);
  });

  it('[security] reset-password rejects an incorrect code instead of trusting the contact alone', async () => {
    // Regression test: this endpoint previously never checked the submitted OTP at
    // all - any request naming a valid, used, unexpired reset row succeeded.
    const mobile = generateMobile();
    await registerAndVerifyDoctor(mobile, 'OldPass@11');
    await requestResetOtp(mobile);

    const res = await request(app)
      .post(`${API}/reset-password`)
      .send({ mobile_number: mobile, otp: '000000', new_password: 'ShouldNotApply@1' });

    expect(res.status).toBe(401);

    const stillOld = await request(app)
      .post(`${API}/login-password`)
      .send({ email_or_mobile: mobile, password: 'OldPass@11' });
    expect(stillOld.status).toBe(200);
  });

  it('[security] a consumed reset code cannot be replayed', async () => {
    const mobile = generateMobile();
    await registerAndVerifyDoctor(mobile, 'OldPass@11');
    const otp = await requestResetOtp(mobile);

    const first = await request(app)
      .post(`${API}/reset-password`)
      .send({ mobile_number: mobile, otp, new_password: 'NewPass@22' });
    expect(first.status).toBe(200);

    const replay = await request(app)
      .post(`${API}/reset-password`)
      .send({ mobile_number: mobile, otp, new_password: 'AnotherPass@33' });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('OTP_USED');
  });
});
