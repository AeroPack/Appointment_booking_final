import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { getStats, getPatients, getVenueTypeStats } from './dashboard.controller.js';

const router = Router();

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

router.get('/doctor/stats', authGuard, requireRole('doctor'), validate(dateRangeSchema, 'query'), getStats);
router.get('/doctor/patients', authGuard, requireRole('doctor'), validate(dateRangeSchema, 'query'), getPatients);
router.get('/doctor/venue-type-stats', authGuard, requireRole('doctor'), validate(dateRangeSchema, 'query'), getVenueTypeStats);

export default router;
