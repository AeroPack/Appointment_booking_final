import { Router } from 'express';
import { handleWhatsAppWebhook } from './flow.webhook-controller.js';
import { internalAuth } from '../../middleware/internalAuth.js';

const router = Router();

router.post('/webhooks/whatsapp/:clinicId', internalAuth, handleWhatsAppWebhook);

export default router;
