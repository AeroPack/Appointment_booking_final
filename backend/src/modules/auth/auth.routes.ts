import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authGuard } from '../../middleware/authGuard.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { sendOtp, verifyOtp, refresh, logout, me } from './auth.controller.js';

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

router.post('/request-otp', rateLimit(60_000, 5), validate(requestOtpSchema), sendOtp);
router.post('/verify-otp', rateLimit(60_000, 10), validate(verifyOtpSchema), verifyOtp);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', authGuard, validate(logoutSchema), logout);
router.get('/me', authGuard, me);

export default router;
