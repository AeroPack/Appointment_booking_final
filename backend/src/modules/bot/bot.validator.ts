import { z } from 'zod';

export const botSlotsSchema = z.object({
  doctor_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

export const botBookSchema = z.object({
  doctor_id: z.string().uuid(),
  patient_name: z.string().min(1).max(200),
  patient_phone: z.string().min(5).max(20),
  slot_start: z.string().datetime({ offset: true }),
  reason: z.string().max(500).optional(),
});

export const botDoctorParamsSchema = z.object({
  id: z.string().uuid(),
});

export const botFaqSchema = z.object({
  doctor_id: z.string().uuid(),
  query: z.string().min(1).max(500),
});

export const botLookupSchema = z.object({
  phone: z.string().min(5).max(20),
  doctor_id: z.string().uuid(),
});

export const botConfigParamsSchema = z.object({
  doctor_id: z.string().uuid(),
});
