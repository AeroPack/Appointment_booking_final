import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

export function internalAuth(req: Request, _res: Response, next: NextFunction) {
  const key = req.headers['x-internal-key'];
  const expected = process.env['INTERNAL_API_KEY'];

  if (!expected) {
    throw new AppError(500, 'INTERNAL_API_KEY_NOT_CONFIGURED', 'INTERNAL_API_KEY is not set on the server');
  }

  if (!key || key !== expected) {
    throw new AppError(401, 'INVALID_INTERNAL_KEY', 'Invalid or missing internal API key');
  }

  next();
}
