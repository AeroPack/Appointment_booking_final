import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createTag, listTags, getTag, updateTag, deleteTag,
  assignTag, unassignTag, listUserTags,
} from './tags.controller.js';

const router = Router();

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_auto: z.boolean().optional(),
  rule_definition: z.record(z.string(), z.unknown()).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  rule_definition: z.record(z.string(), z.unknown()).nullable().optional(),
});

const assignTagSchema = z.object({
  tag_id: z.string().uuid(),
});

router.post('/tags', authGuard, requireRole('staff', 'doctor'), validate(createTagSchema), createTag);
router.get('/tags', authGuard, listTags);
router.get('/tags/:id', authGuard, getTag);
router.patch('/tags/:id', authGuard, requireRole('staff', 'doctor'), validate(updateTagSchema), updateTag);
router.delete('/tags/:id', authGuard, requireRole('staff', 'doctor'), deleteTag);

router.post('/users/:userId/tags', authGuard, requireRole('staff', 'doctor'), validate(assignTagSchema), assignTag);
router.delete('/users/:userId/tags/:tagId', authGuard, requireRole('staff', 'doctor'), unassignTag);
router.get('/users/:userId/tags', authGuard, listUserTags);

export default router;
