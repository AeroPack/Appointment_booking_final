import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/response.js';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    // Never log req[source]: these bodies carry plaintext passwords and OTPs.
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(
        (e) => `${String(e.path.join('.'))}: ${e.message}`
      );
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);
    }
    if (source === 'body' && result.data) {
      req.body = result.data;
    }
    next();
  };
}
