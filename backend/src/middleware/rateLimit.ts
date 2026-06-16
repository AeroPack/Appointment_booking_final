import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function resetRateLimiter(): void {
  store.clear();
}

export function rateLimit(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    console.log(`[RATE] ${req.method} ${req.originalUrl} from ${key} — count=${entry?.count ?? 0}/${max}`);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      console.log(`[RATE] BLOCKED ${key} — retry after ${retryAfter}s`);
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later');
    }

    next();
  };
}
