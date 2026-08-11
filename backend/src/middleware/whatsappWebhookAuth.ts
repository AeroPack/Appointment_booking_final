import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '../utils/response.js';
import pool from '../config/db.js';

declare global {
  namespace Express {
    interface Request {
      webhookClinicId?: string;
      /** Raw request bytes, captured in app.ts for signature verification. */
      rawBody?: Buffer;
    }
  }
}

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw request body.
 *
 * This is the only check that proves a delivery actually came from Meta. The
 * ?key= clinic secret in the URL identifies *which* clinic the delivery is
 * for, but it travels in the query string and so leaks into proxy and access
 * logs - it is routing, not authentication.
 *
 * @param req - Inbound request, expected to carry rawBody
 * @returns True when the signature matches, or when no app secret is configured
 */
function hasValidSignature(req: Request): boolean {
  const appSecret = process.env['WA_CLOUD_APP_SECRET'];

  // Not configured: the BhashSMS provider does not sign its callbacks, so
  // refusing here would break that path. The ?key= check still applies.
  if (!appSecret) {
    return true;
  }

  const header = req.get('x-hub-signature-256');
  if (!header || !header.startsWith('sha256=')) {
    return false;
  }

  if (!req.rawBody) {
    console.error('[whatsappWebhookAuth] rawBody missing - check the express.json verify hook in app.ts');
    return false;
  }

  const expected = crypto.createHmac('sha256', appSecret).update(req.rawBody).digest();
  const received = Buffer.from(header.slice('sha256='.length), 'hex');

  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (received.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, received);
}

export async function whatsappWebhookAuth(req: Request, _res: Response, next: NextFunction) {
  const clinicIdParam = req.params.clinicId;
  const clinicId = Array.isArray(clinicIdParam) ? clinicIdParam[0] : clinicIdParam;
  const key = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;

  if (!clinicId) {
    throw new AppError(400, 'MISSING_CLINIC_ID', 'clinicId is required');
  }

  if (!key || typeof key !== 'string') {
    throw new AppError(401, 'MISSING_WEBHOOK_KEY', 'Invalid or missing webhook key');
  }

  if (!hasValidSignature(req)) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
  }

  const result = await pool.query(
    `SELECT id FROM clinics WHERE id = $1 AND whatsapp_webhook_secret::text = $2`,
    [clinicId, key]
  );

  if (result.rows.length === 0) {
    throw new AppError(401, 'INVALID_WEBHOOK_KEY', 'Invalid webhook key for this clinic');
  }

  req.webhookClinicId = clinicId;
  next();
}
