import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  findSlots,
  bookSlot,
  listAppointments,
  getAppointment,
  cancelAppointment,
  updateAppointmentStatus,
  bookOnBehalf,
} from './appointments.controller.js';

const router = Router();

const findSlotsSchema = z.object({
  doctor_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

const bookSlotSchema = z.object({
  doctor_id: z.string().uuid(),
  scheduled_start: z.string().datetime({ offset: true }),
  patient_id: z.string().uuid().optional(),
  idempotency_key: z.string().min(1).max(255),
});

const statusSchema = z.object({
  status: z.enum(['finished', 'no_show']),
});

const bookOnBehalfSchema = z.object({
  doctor_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  scheduled_start: z.string().datetime({ offset: true }),
  idempotency_key: z.string().min(1).max(255),
});

router.get('/patient/find-slots', authGuard, validate(findSlotsSchema, 'query'), findSlots);
router.post('/patient/book-slot', authGuard, requireRole('patient'), validate(bookSlotSchema), bookSlot);
router.get('/patient/appointments', authGuard, listAppointments);
router.get('/patient/appointments/:id', authGuard, getAppointment);
router.patch('/patient/appointments/:id/cancel', authGuard, cancelAppointment);
router.patch('/appointments/:id/status', authGuard, requireRole('doctor', 'staff'), validate(statusSchema), updateAppointmentStatus);
router.post('/appointments/book', authGuard, requireRole('doctor', 'staff'), validate(bookOnBehalfSchema), bookOnBehalf);

export default router;
