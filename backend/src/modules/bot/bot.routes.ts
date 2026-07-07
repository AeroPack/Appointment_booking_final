import { Router } from 'express';
import { z } from 'zod';
import { botAuth } from '../../middleware/botAuth.js';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
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
} from './bot.controller.js';

const router = Router();

const botSlotsSchema = z.object({
  doctor_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

const botBookSchema = z.object({
  doctor_id: z.string().uuid(),
  patient_name: z.string().min(1).max(200),
  patient_phone: z.string().min(5).max(20),
  slot_start: z.string().datetime({ offset: true }),
  reason: z.string().max(500).optional(),
});

const botFaqQuerySchema = z.object({
  doctor_id: z.string().uuid(),
  query: z.string().min(1).max(500),
});

const botLookupSchema = z.object({
  phone: z.string().min(5).max(20),
  doctor_id: z.string().uuid(),
});

const botConfigQuerySchema = z.object({
  doctor_id: z.string().uuid(),
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

// Public bot endpoints (authenticated via bot API key)
router.get('/bot/slots', botAuth, validate(botSlotsSchema, 'query'), getSlots);
router.post('/bot/book', botAuth, validate(botBookSchema), bookAppointment);
router.get('/bot/doctor/:id', botAuth, getDoctorInfo);
router.get('/bot/faq', botAuth, validate(botFaqQuerySchema, 'query'), searchFaq);
router.get('/bot/lookup', botAuth, validate(botLookupSchema, 'query'), lookupPatient);
router.get('/bot/config', botAuth, validate(botConfigQuerySchema, 'query'), getConfig);

// Doctor-only endpoints (authenticated via JWT)
router.get('/doctor/chatbot-config', authGuard, requireRole('doctor'), getConfig);
router.put('/doctor/chatbot-config', authGuard, requireRole('doctor'), validate(botConfigBodySchema), updateConfig);
router.get('/doctor/faq', authGuard, requireRole('doctor'), listFaq);
router.post('/doctor/faq', authGuard, requireRole('doctor'), validate(faqCreateSchema), createFaq);
router.patch('/doctor/faq/:id', authGuard, requireRole('doctor'), validate(faqUpdateSchema), updateFaq);
router.delete('/doctor/faq/:id', authGuard, requireRole('doctor'), deleteFaq);

export default router;
