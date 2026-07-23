import { Router } from 'express';
import { z } from 'zod';
import { botAuth } from '../../middleware/botAuth.js';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { internalAuth } from '../../middleware/internalAuth.js';
import { validate } from '../../middleware/validate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import {
  getSlots,
  bookAppointment,
  getDoctorInfo,
  searchFaq,
  lookupPatient,
  getConfig,
  updateConfig,
  listFaq,
  createFaq,
  updateFaq,
  deleteFaq,
  setTypebotEmbed,
  regenerateWidgetKey,
  extractField,
} from './bot.controller.js';

const router = Router();

const botSlotsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

const botBookSchema = z.object({
  patient_name: z.string().min(1).max(200),
  patient_phone: z.string().min(5).max(20),
  slot_start: z.string().datetime({ offset: true }),
  reason: z.string().max(500).optional(),
});

const botFaqQuerySchema = z.object({
  query: z.string().min(1).max(500),
});

const botLookupSchema = z.object({
  phone: z.string().min(5).max(20),
});

const botConfigBodySchema = z.object({
  is_enabled: z.boolean().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional(),
  greeting_msg: z.string().max(500).optional(),
  position: z.enum(['bottom-right', 'bottom-left']).optional(),
});

const faqCreateSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000),
  keywords: z.array(z.string()).optional(),
});

const faqUpdateSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(2000).optional(),
  keywords: z.array(z.string()).optional(),
});

const internalEmbedSchema = z.object({
  typebot_embed_snippet: z.string().min(1).max(5000),
});

const extractSchema = z.object({
  text: z.string().min(1).max(2000),
  field_type: z.enum(['name', 'phone', 'reason', 'faq']),
});

// Public bot endpoints — authenticated via per-doctor X-Widget-Key (botAuth resolves req.botDoctorId).
// Embedded widget on third-party doctor websites; CORS is handled by botCors in app.ts.
// Scoped rate limiting guards against abuse.
router.use('/bot', rateLimit(60_000, 30));
router.get('/bot/slots', botAuth, validate(botSlotsSchema, 'query'), getSlots);
router.post('/bot/book', botAuth, validate(botBookSchema), bookAppointment);
router.post('/bot/extract', botAuth, validate(extractSchema), extractField);
router.get('/bot/doctor', botAuth, getDoctorInfo);
router.get('/bot/faq', botAuth, validate(botFaqQuerySchema, 'query'), searchFaq);
router.get('/bot/lookup', botAuth, validate(botLookupSchema, 'query'), lookupPatient);
router.get('/bot/config', botAuth, getConfig);

// Doctor-only endpoints (authenticated via JWT)
router.get('/doctor/chatbot-config', authGuard, requireRole('doctor'), getConfig);
router.put('/doctor/chatbot-config', authGuard, requireRole('doctor'), validate(botConfigBodySchema), updateConfig);
router.post('/doctor/chatbot-config/regenerate-widget-key', authGuard, requireRole('doctor'), regenerateWidgetKey);
router.get('/doctor/faq', authGuard, requireRole('doctor'), listFaq);
router.post('/doctor/faq', authGuard, requireRole('doctor'), validate(faqCreateSchema), createFaq);
router.patch('/doctor/faq/:id', authGuard, requireRole('doctor'), validate(faqUpdateSchema), updateFaq);
router.delete('/doctor/faq/:id', authGuard, requireRole('doctor'), deleteFaq);

// Internal ops-only endpoint to set a doctor's published Typebot embed snippet.
router.put(
  '/internal/doctor/:doctorId/chatbot-embed',
  internalAuth,
  validate(internalEmbedSchema),
  setTypebotEmbed
);

export default router;
