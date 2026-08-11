import { Router } from 'express';
import { handleWhatsAppWebhook, verifyWhatsAppWebhook } from './flow.webhook-controller.js';
import { whatsappWebhookAuth } from '../../middleware/whatsappWebhookAuth.js';
import { rateLimit } from '../../middleware/rateLimit.js';

const router = Router();

// Meta's subscription handshake. It carries only hub.* query params - no
// clinic key and no signature - so it authenticates on WA_CLOUD_VERIFY_TOKEN
// alone and cannot go through whatsappWebhookAuth.
router.get('/webhooks/whatsapp/:clinicId', rateLimit(60_000, 30), verifyWhatsAppWebhook);

router.post(
  '/webhooks/whatsapp/:clinicId',
  rateLimit(60_000, 120),
  whatsappWebhookAuth,
  handleWhatsAppWebhook
);

export default router;
