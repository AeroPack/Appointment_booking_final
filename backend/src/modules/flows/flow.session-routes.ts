import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  startSession,
  respondToSession,
  getSession,
  getSessionMessages,
} from './flow.session-controller.js';

const router = Router();

router.post('/flow-sessions', authGuard, requireRole('patient'), startSession);
router.post('/flow-sessions/:sessionId/respond', authGuard, requireRole('patient'), respondToSession);
router.get('/flow-sessions/:sessionId', authGuard, requireRole('patient'), getSession);
router.get('/flow-sessions/:sessionId/messages', authGuard, requireRole('patient'), getSessionMessages);

export default router;
