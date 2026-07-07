import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

export function botAuth(req: Request, _res: Response, next: NextFunction) {
  const key = req.headers['x-bot-key'];
  const expected = process.env['BOT_API_KEY'];

  if (!expected) {
    throw new AppError(500, 'BOT_API_KEY_NOT_CONFIGURED', 'BOT_API_KEY is not set on the server');
  }

  if (!key || key !== expected) {
    throw new AppError(401, 'INVALID_BOT_KEY', 'Invalid or missing bot API key');
  }

  next();
}
