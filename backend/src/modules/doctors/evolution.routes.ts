import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  connectWhatsApp,
  getQrCode,
  getWhatsAppStatus,
  disconnectWhatsApp,
} from './evolution.controller.js';

const router = Router();

const connectSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
});

router.post(
  '/doctor/whatsapp/connect',
  authGuard,
  requireRole('doctor'),
  validate(connectSchema),
  connectWhatsApp
);
router.get('/doctor/whatsapp/qr', authGuard, requireRole('doctor'), getQrCode);
router.get('/doctor/whatsapp/status', authGuard, requireRole('doctor'), getWhatsAppStatus);
router.post('/doctor/whatsapp/disconnect', authGuard, requireRole('doctor'), disconnectWhatsApp);

export default router;
