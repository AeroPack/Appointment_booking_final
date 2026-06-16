import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { MessagesService } from './messages.service.js';
import { MessagesRepository } from './messages.repository.js';

const repo = new MessagesRepository();
export const messagesService = new MessagesService(repo);

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messagesService.sendMessage(req.auth!.clinicId, req.auth!.userId, req.body);
    res.json({ message: 'scheduled' });
  } catch (err) {
    next(err);
  }
}
