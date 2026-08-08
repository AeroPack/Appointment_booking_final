import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Buckets are keyed by scope, so each route gets its own counter. Keying on the
 * client alone made every rate-limited route share one entry: three requests to
 * any auth endpoint exhausted the 3/min signup budget, and the next signup 429'd
 * before it reached the service - no user, no clinic, no OTP created.
 */
const store = new Map<string, RateLimitEntry>();

export function resetRateLimiter(): void {
  store.clear();
}

/**
 * Identify who a request should be counted against.
 * Behind a reverse proxy every browser shares one source address, so routes
 * that act on a specific account count per account instead.
 */
export type RateLimitSubject = (req: Request) => string | undefined;

/** Count against the account named in the request body, not the source address. */
export const byContact: RateLimitSubject = (req) => {
  const body = req.body as
    | { mobile_number?: string; email?: string; email_or_mobile?: string }
    | undefined;
  return body?.email_or_mobile || body?.mobile_number || body?.email;
};

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Limit how often a subject may call a route.
 * @param windowMs - Length of the rolling window in milliseconds
 * @param max - Requests allowed per subject per window
 * @param subject - What to count against; defaults to the client address
 * @returns Express middleware
 */
export function rateLimit(windowMs: number, max: number, subject?: RateLimitSubject) {
  return (req: Request, res: Response, next: NextFunction) => {
    // The route keeps each endpoint's budget separate; without it every
    // rateLimit() instance increments the same entry.
    const scope = req.baseUrl + req.path;
    const key = `${scope}|${subject?.(req) ?? clientKey(req)}`;

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      throw new AppError(
        429,
        'RATE_LIMITED',
        `Too many attempts. Please try again in ${retryAfter} second(s).`
      );
    }

    next();
  };
}
