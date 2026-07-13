import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authGuard } from '../../middleware/authGuard.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { 
  sendOtp, verifyOtp, refresh, logout, me,
  register, verifyRegistrationOtp, loginWithPassword,
  updateProfile, setupWhatsApp,
  forgotPassword, verifyPasswordResetOtp, resetPassword
} from './auth.controller.js';

const router = Router();
console.log("!!! ROUTES LOADED !!!");


const requestOtpSchema = z.union([
  z.object({ mobile_number: z.string().min(10).max(20), email: z.string().email().optional() }),
  z.object({ mobile_number: z.string().optional(), email: z.string().email() }),
]);

const verifyOtpSchema = z.object({
  mobile_number: z.string().min(10).max(20).optional(),
  email: z.string().email().optional(),
  otp: z.string().length(6),
}).refine(data => data.mobile_number || data.email, {
  message: 'THIS IS A TEST MESSAGE',
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const logoutSchema = z.object({
  refresh_token: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email().optional(),
  mobile_number: z.string().min(10).max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
}).refine(data => data.email || data.mobile_number, {
  message: 'Either email or mobile number is required',
});

const verifyRegistrationSchema = z.object({
  user_id: z.string().uuid(),
  otp: z.string().length(6),
});

const loginPasswordSchema = z.object({
  email_or_mobile: z.string().min(1),
  password: z.string().min(1),
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
  whatsapp_number: z.string().optional(),
});

const forgotPasswordSchema = z.union([
  z.object({ mobile_number: z.string().min(10).max(20), email: z.string().email().optional() }),
  z.object({ mobile_number: z.string().optional(), email: z.string().email() }),
]).refine(data => data.mobile_number || data.email, {
  message: 'Either email or mobile number is required',
});

const verifyPasswordResetSchema = z.object({
  user_id: z.string().uuid(),
  otp: z.string().length(6),
});

const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  otp: z.string().length(6),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Existing routes
router.post('/request-otp', rateLimit(60_000, 5), validate(requestOtpSchema), sendOtp);
router.post('/verify-otp', rateLimit(60_000, 10), validate(verifyOtpSchema), verifyOtp);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', authGuard, validate(logoutSchema), logout);
router.get('/me', authGuard, me);

// Registration routes
router.post('/register', rateLimit(60_000, 3), validate(registerSchema), register);
router.post('/verify-registration-otp', rateLimit(60_000, 10), validate(verifyRegistrationSchema), verifyRegistrationOtp);

// Password login route
router.post('/login-password', rateLimit(60_000, 10), validate(loginPasswordSchema), loginWithPassword);

// Protected routes (require authentication)
router.post('/update-profile', authGuard, validate(updateProfileSchema), updateProfile);
router.post('/setup-whatsapp', authGuard, validate(setupWhatsAppSchema), setupWhatsApp);

// Password reset routes (public)
router.post('/forgot-password', rateLimit(60_000, 5), validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-password-reset-otp', rateLimit(60_000, 10), validate(verifyPasswordResetSchema), verifyPasswordResetOtp);
router.post('/reset-password', rateLimit(60_000, 5), validate(resetPasswordSchema), resetPassword);

export default router;
