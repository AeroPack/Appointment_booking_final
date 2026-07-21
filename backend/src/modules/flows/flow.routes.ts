import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { FLOW_NODE_TYPES } from './flow.node-schemas.js';
import {
  createFlow,
  listFlows,
  getFlowDetail,
  getVersion,
  autosaveDraft,
  getOrCreateDraft,
  publishVersion,
  rollbackToVersion,
} from './flow.controller.js';

const router = Router();

const createFlowSchema = z.object({
  name: z.string().min(1).max(100),
  trigger_type: z.enum(['book', 'reschedule', 'cancel']).default('book'),
});

const autosaveSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(FLOW_NODE_TYPES as [string, ...string[]]),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.unknown()),
  })),
  edges: z.array(z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  })),
});

const rollbackSchema = z.object({
  version_id: z.string().uuid(),
});

const flowIdParam = z.object({
  flowId: z.string().uuid(),
});

const versionIdParam = z.object({
  flowId: z.string().uuid(),
  versionId: z.string().uuid(),
});

router.post('/doctor/flows', authGuard, requireRole('doctor'), validate(createFlowSchema), createFlow);
router.get('/doctor/flows', authGuard, requireRole('doctor'), listFlows);
router.get('/doctor/flows/:flowId', authGuard, requireRole('doctor'), validate(flowIdParam, 'params'), getFlowDetail);
router.get('/doctor/flows/:flowId/versions/:versionId', authGuard, requireRole('doctor'), validate(versionIdParam, 'params'), getVersion);
router.put('/doctor/flows/:flowId/versions/:versionId', authGuard, requireRole('doctor'), validate(versionIdParam, 'params'), validate(autosaveSchema), autosaveDraft);
router.post('/doctor/flows/:flowId/draft', authGuard, requireRole('doctor'), validate(flowIdParam, 'params'), getOrCreateDraft);
router.post('/doctor/flows/:flowId/versions/:versionId/publish', authGuard, requireRole('doctor'), validate(versionIdParam, 'params'), publishVersion);
router.post('/doctor/flows/:flowId/rollback', authGuard, requireRole('doctor'), validate(flowIdParam, 'params'), validate(rollbackSchema), rollbackToVersion);

export default router;
