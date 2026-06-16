import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  const url = req.originalUrl;

  if (err instanceof AppError) {
    console.log(`[${err.status}] ${method} ${url} — ${err.code}: ${err.message}`);
    if (err.details.length) {
      console.log(`  details: ${err.details.join(', ')}`);
    }
    res.status(err.status).json(err.toJSON());
    return;
  }

  console.error(`[500] ${method} ${url} —`, err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: [],
    },
  });
}
