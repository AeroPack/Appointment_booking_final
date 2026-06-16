import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

export function clinicScope(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !req.auth.clinicId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  next();
}
