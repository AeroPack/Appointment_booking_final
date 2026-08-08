import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authGuard } from '../../middleware/authGuard.js';
import { rateLimit, byContact } from '../../middleware/rateLimit.js';
import { validatePasswordStrength } from '../../utils/password.js';
import { isValidPhone } from '../../utils/phone.js';
import {
  sendOtp, verifyOtp, refresh, logout, me,
  register, verifyRegistrationOtp, loginWithPassword,
  updateProfile, setupWhatsApp,
  forgotPassword, verifyPasswordResetOtp, resetPassword,
} from './auth.controller.js';

const router = Router();

const MINUTE = 60_000;

// ─── Field schemas ────────────────────────────────────────────────────────────

const mobile = z.string().refine(isValidPhone, 'Enter a valid mobile number');
const email = z.string().email('Enter a valid email address');
const otp = z.string().length(6, 'Enter the 6-digit code');

/** Password rules live in one place (utils/password.ts) and are enforced here. */
const password = z.string().superRefine((value, ctx) => {
  const { isValid, message } = validatePasswordStrength(value);
  if (!isValid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
});

/** Exactly one contact is required; either field alone is enough. */
const contact = z
  .object({ mobile_number: mobile.optional(), email: email.optional() })
  .refine((d) => d.mobile_number || d.email, 'An email or mobile number is required');

// ─── Request schemas ──────────────────────────────────────────────────────────

const requestOtpSchema = contact;
const verifyOtpSchema = contact.and(z.object({ otp }));

const refreshSchema = z.object({ refresh_token: z.string().min(1) });
const logoutSchema = refreshSchema;

const registerSchema = contact.and(
  z.object({ name: z.string().min(2, 'Name must be at least 2 characters'), password })
);
const verifyRegistrationSchema = z.object({ user_id: z.string().uuid(), otp });

const loginPasswordSchema = z.object({
  email_or_mobile: z.string().min(1, 'Enter your email or mobile number'),
  password: z.string().min(1, 'Enter your password'),
});

const updateProfileSchema = z.object({
  title: z.enum(['Dr.', 'Prof.', 'Mr.', 'Ms.']).optional(),
  speciality: z.string().optional(),
  qualification: z.string().optional(),
  registration_number: z.string().optional(),
  consultation_fee: z.number().positive().optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  bio: z.string().max(500).optional(),
});

const setupWhatsAppSchema = z.object({
  whatsapp_enabled: z.boolean().optional(),
  ultramsg_instance_id: z.string().optional(),
  ultramsg_token: z.string().optional(),
  whatsapp_number: mobile.optional(),
});

// Password reset is addressed by contact, not by a user_id handed out by the API.
const forgotPasswordSchema = contact;
const verifyPasswordResetSchema = contact.and(z.object({ otp }));
const resetPasswordSchema = contact.and(z.object({ otp, new_password: password }));

// ─── Routes ───────────────────────────────────────────────────────────────────
//
// Limits are keyed per route and, where a request names an account, per account.
// Behind the reverse proxy every browser shares one source address, so keying on
// the address alone let any user exhaust everyone else's budget.

// Patient sign-in: OTP only. An unrecognized contact becomes a new patient.
router.post('/request-otp', rateLimit(MINUTE, 5, byContact), validate(requestOtpSchema), sendOtp);
router.post('/verify-otp', rateLimit(MINUTE, 10, byContact), validate(verifyOtpSchema), verifyOtp);

// Sessions
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', authGuard, validate(logoutSchema), logout);
router.get('/me', authGuard, me);

// Doctor sign-up
router.post('/register', rateLimit(MINUTE, 5, byContact), validate(registerSchema), register);
router.post(
  '/verify-registration-otp',
  rateLimit(MINUTE, 10),
  validate(verifyRegistrationSchema),
  verifyRegistrationOtp
);

// Doctor sign-in
router.post(
  '/login-password',
  rateLimit(MINUTE, 10, byContact),
  validate(loginPasswordSchema),
  loginWithPassword
);

// Doctor profile / clinic settings
router.post('/update-profile', authGuard, validate(updateProfileSchema), updateProfile);
router.post('/setup-whatsapp', authGuard, validate(setupWhatsAppSchema), setupWhatsApp);

// Password reset
router.post(
  '/forgot-password',
  rateLimit(MINUTE, 5, byContact),
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post(
  '/verify-password-reset-otp',
  rateLimit(MINUTE, 10, byContact),
  validate(verifyPasswordResetSchema),
  verifyPasswordResetOtp
);
router.post(
  '/reset-password',
  rateLimit(MINUTE, 10, byContact),
  validate(resetPasswordSchema),
  resetPassword
);

export default router;
