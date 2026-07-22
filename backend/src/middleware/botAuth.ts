import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response.js';
import pool from '../config/db.js';

declare global {
  namespace Express {
    interface Request {
      botDoctorId?: string;
    }
  }
}

export async function botAuth(req: Request, _res: Response, next: NextFunction) {
  const widgetKey = req.headers['x-widget-key'];
  if (!widgetKey || typeof widgetKey !== 'string') {
    throw new AppError(401, 'MISSING_WIDGET_KEY', 'Invalid or missing widget key');
  }

  const result = await pool.query(
    `SELECT doctor_id FROM doctor_chatbot_config WHERE widget_key = $1 AND is_enabled = true`,
    [widgetKey]
  );

  const doctorId = result.rows[0]?.doctor_id;
  if (!doctorId) {
    throw new AppError(401, 'INVALID_WIDGET_KEY', 'Invalid or disabled widget key');
  }

  req.botDoctorId = doctorId;
  next();
}
