import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  getSettings,
  putSettings,
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from './settings.controller.js';

const router = Router();

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const periodSchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM format'),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM format'),
  venue_id: z.string().uuid().optional(),
  slot_duration_minutes: z.number().int().positive(),
  max_patients_per_slot: z.number().int().positive(),
}).refine((p) => p.start_time < p.end_time, {
  message: 'start_time must be before end_time',
});

const reminderSchema = z.object({
  template_type: z.enum(['reminder', 'booking_confirmation', 'appointment_cancelled']),
  offset_minutes: z.number().int().positive().optional(),
  subject: z.string().optional(),
  content: z.string().min(1),
  channel: z.enum(['whatsapp', 'sms', 'email']).optional(),
});

const putSettingsSchema = z.object({
  doctor_id: z.string().uuid(),
  periods: z.array(periodSchema),
  reminders: z.array(reminderSchema),
});

const createTemplateSchema = z.object({
  doctor_id: z.string().uuid().optional(),
  template_type: z.enum(['reminder', 'booking_confirmation', 'appointment_cancelled']),
  subject: z.string().optional(),
  content: z.string().min(1),
  offset_minutes: z.number().int().positive().optional(),
  channel: z.enum(['whatsapp', 'sms', 'email']).optional(),
});

const updateTemplateSchema = z.object({
  template_type: z.enum(['reminder', 'booking_confirmation', 'appointment_cancelled']).optional(),
  subject: z.string().optional(),
  content: z.string().min(1).optional(),
  offset_minutes: z.number().int().positive().nullable().optional(),
  channel: z.enum(['whatsapp', 'sms', 'email']).optional(),
  is_active: z.boolean().optional(),
});

router.get('/appointment-setting', authGuard, getSettings);
router.put('/appointment-setting', authGuard, requireRole('doctor', 'staff'), validate(putSettingsSchema), putSettings);

router.get('/message-templates', authGuard, listTemplates);
router.post('/message-templates', authGuard, requireRole('doctor', 'staff'), validate(createTemplateSchema), createTemplate);
router.patch('/message-templates/:id', authGuard, requireRole('doctor', 'staff'), validate(updateTemplateSchema), updateTemplate);
router.delete('/message-templates/:id', authGuard, requireRole('doctor', 'staff'), deleteTemplate);

export default router;
