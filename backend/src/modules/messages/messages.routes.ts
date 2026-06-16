import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { sendMessage } from './messages.controller.js';

const router = Router();

const sendMessageSchema = z.object({
  template_id: z.string().uuid(),
  receiver_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  schedule_for: z.string().datetime({ offset: true }).optional(),
});

router.post('/send-message', authGuard, requireRole('staff'), validate(sendMessageSchema), sendMessage);

export default router;
