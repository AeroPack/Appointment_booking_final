import { Router } from 'express';
import { handleWhatsAppWebhook } from './flow.webhook-controller.js';
import { whatsappWebhookAuth } from '../../middleware/whatsappWebhookAuth.js';
import { rateLimit } from '../../middleware/rateLimit.js';

const router = Router();

router.post(
  '/webhooks/whatsapp/:clinicId',
  rateLimit(60_000, 120),
  whatsappWebhookAuth,
  handleWhatsAppWebhook
);

export default router;
