import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { getStats, getTodayPatients } from './dashboard.controller.js';

const router = Router();

const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

router.get('/doctor/stats', authGuard, requireRole('doctor'), validate(dateQuerySchema, 'query'), getStats);
router.get('/doctor/today-patients', authGuard, requireRole('doctor'), validate(dateQuerySchema, 'query'), getTodayPatients);

export default router;
