import type { Request, Response } from 'express';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowSessionService } from './flow.session-service.js';
import { AppError } from '../../utils/response.js';
import pool from '../../config/db.js';

const repo = new FlowSessionRepository();
const service = new FlowSessionService(repo);

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+91' + cleaned.substring(1);
    } else if (/^\d{10}$/.test(cleaned)) {
      cleaned = '+91' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

export async function handleWhatsAppWebhook(req: Request, res: Response) {
  const { clinicId } = req.params;
  const { from, body: messageBody, id: channelMessageId } = req.body;

  if (!from || !messageBody) {
    res.status(200).json({ ok: true });
    return;
  }

  const normalizedPhone = normalizePhone(from);

  const clinicResult = await pool.query(
    `SELECT id FROM clinics WHERE id = $1`,
    [clinicId]
  );
  if (clinicResult.rows.length === 0) {
    res.status(200).json({ ok: true });
    return;
  }

  const doctorResult = await pool.query(
    `SELECT id FROM users WHERE clinic_id = $1 AND role = 'doctor' AND deleted_at IS NULL LIMIT 1`,
    [clinicId]
  );
  if (doctorResult.rows.length === 0) {
    res.status(200).json({ ok: true });
    return;
  }
  const doctorId = doctorResult.rows[0].id;

  try {
    const activeSession = await repo.findActiveSession(doctorId, normalizedPhone);

    if (activeSession) {
      if (activeSession.status === 'completed' || activeSession.status === 'error') {
        const result = await service.startSession({
          doctorId,
          patientId: null,
          channel: 'whatsapp',
          channelSessionId: normalizedPhone,
          triggerType: 'book',
        });
        res.status(200).json({ ok: true });
        return;
      }

      await service.resumeSession({
        sessionId: activeSession.id,
        doctorId,
        channelSessionId: normalizedPhone,
        input: messageBody,
      });
      res.status(200).json({ ok: true });
      return;
    }

    await service.startSession({
      doctorId,
      patientId: null,
      channel: 'whatsapp',
      channelSessionId: normalizedPhone,
      triggerType: 'book',
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[WhatsAppWebhook] Error:', err);
    res.status(200).json({ ok: true });
  }
}
