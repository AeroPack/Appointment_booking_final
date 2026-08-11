import { Router } from 'express';
import { handleEvolutionWebhook } from './flow.webhook-evolution-controller.js';
import { rateLimit } from '../../middleware/rateLimit.js';

const router = Router();

router.post(
  '/webhooks/whatsapp-evolution/:instanceName',
  rateLimit(60_000, 120),
  handleEvolutionWebhook
);

export default router;
