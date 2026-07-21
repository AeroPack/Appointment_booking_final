import type { Request, Response } from 'express';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowSessionService } from './flow.session-service.js';
import { success } from '../../utils/response.js';

const repo = new FlowSessionRepository();
const service = new FlowSessionService(repo);

export async function startSession(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const { doctor_id, trigger_type } = req.body;

  const result = await service.startSession({
    doctorId: doctor_id,
    patientId: userId,
    channel: 'web',
    channelSessionId: userId,
    triggerType: trigger_type || 'book',
  });

  res.json(success(result));
}

export async function respondToSession(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const sessionId = req.params.sessionId as string;
  const { input } = req.body;

  const result = await service.respondToSession({
    sessionId,
    doctorId: userId,
    channelSessionId: userId,
    input,
  });

  res.json(success(result));
}

export async function getSession(req: Request, res: Response) {
  const sessionId = req.params.sessionId as string;
  const session = await service.getSession(sessionId);
  res.json(success(session));
}

export async function getSessionMessages(req: Request, res: Response) {
  const sessionId = req.params.sessionId as string;
  const messages = await service.getMessages(sessionId);
  res.json(success(messages));
}
