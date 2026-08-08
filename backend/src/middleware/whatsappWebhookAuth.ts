import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';
import pool from '../config/db.js';

declare global {
  namespace Express {
    interface Request {
      webhookClinicId?: string;
    }
  }
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
