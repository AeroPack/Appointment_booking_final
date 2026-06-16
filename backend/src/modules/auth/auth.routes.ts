import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authGuard } from '../../middleware/authGuard.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { sendOtp, verifyOtp, refresh, logout, me } from './auth.controller.js';

const router = Router();

const requestOtpSchema = z.object({
  mobile_number: z.string().min(10).max(20),
});

const verifyOtpSchema = z.object({
  mobile_number: z.string().min(10).max(20),
  otp: z.string().length(6),
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
