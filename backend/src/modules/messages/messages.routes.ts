import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { sendMessage, sendOtp, verifyOtp } from './messages.controller.js';

const router = Router();

const sendMessageSchema = z.object({
  template_id: z.string().uuid(),
  receiver_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  schedule_for: z.string().datetime({ offset: true }).optional(),
});

const sendOtpSchema = z.object({
  identifier: z.string().min(1),
  channel: z.enum(['whatsapp', 'email', 'sms']),
});

const verifyOtpSchema = z.object({
  identifier: z.string().min(1),
  otp: z.string().length(6),
  otp_id: z.string().uuid().optional(),
});

router.post('/send-message', authGuard, requireRole('staff'), validate(sendMessageSchema), sendMessage);
router.post('/send-otp', authGuard, requireRole('staff'), validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', authGuard, requireRole('staff'), validate(verifyOtpSchema), verifyOtp);

export default router;
