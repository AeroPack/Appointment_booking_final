import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!roles.includes(req.auth.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
}
