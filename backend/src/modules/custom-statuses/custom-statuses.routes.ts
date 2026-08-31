import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createStatus, listStatuses, getStatus, updateStatus, deleteStatus,
} from './custom-statuses.controller.js';

const router = Router();

const createStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const updateStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

router.post('/custom-statuses', authGuard, requireRole('staff', 'doctor'), validate(createStatusSchema), createStatus);
router.get('/custom-statuses', authGuard, listStatuses);
router.get('/custom-statuses/:id', authGuard, getStatus);
router.patch('/custom-statuses/:id', authGuard, requireRole('staff', 'doctor'), validate(updateStatusSchema), updateStatus);
router.delete('/custom-statuses/:id', authGuard, requireRole('staff', 'doctor'), deleteStatus);

export default router;
