import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/response.js';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`[VALIDATE] Checking ${source} for ${req.method} ${req.originalUrl}:`, JSON.stringify(req[source]));
    const result = schema.safeParse(req[source]);
    if (!result.success) {

      const details = result.error.issues.map(
        (e: any) => `${String(e.path.join('.'))}: ${e.message}`
      );
      console.log(`[VALIDATE] FAILED ${req.method} ${req.originalUrl} — ${details.join('; ')} (MODIFIED)`);
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed (MODIFIED)', details);
    }
    console.log(`[VALIDATE] OK ${req.method} ${req.originalUrl}`);
    if (source === 'body' && result.data) {
      req.body = result.data;
    }
    next();
  };
}
