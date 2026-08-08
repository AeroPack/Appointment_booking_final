import type { Request, Response } from 'express';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowSessionService } from './flow.session-service.js';
import { WhatsAppChannel } from '../../utils/channels/whatsapp.js';
import pool from '../../config/db.js';
import { normalizePhone } from '../../utils/phone.js';

const repo = new FlowSessionRepository();
const service = new FlowSessionService(repo);
const whatsapp = new WhatsAppChannel();

/**
 * UltraMsg inbound webhook payload shape is not fully documented.
 * The `fromMe` / `self` fields are assumed based on common webhook-provider
 * patterns for echo suppression. VERIFY against live UltraMsg docs or a real
 * inbound message before going to production.
 */
function isOutboundEcho(payload: Record<string, unknown>): boolean {
  return payload?.fromMe === true || payload?.self === true;
}

export async function handleWhatsAppWebhook(req: Request, res: Response) {
  // Clinic is already validated by whatsappWebhookAuth middleware.
  const clinicId = req.webhookClinicId!;

  // UltraMsg payload shape: { data: { from, body, id, fromMe, self } } or flat.
  const payload = (req.body?.data ?? req.body) as Record<string, unknown>;
  const from = payload?.from as string | undefined;
  const messageBody = payload?.body as string | undefined;

  if (!from || !messageBody) {
    res.status(200).json({ ok: true });
    return;
  }

  // Skip our own outbound messages echoed back.
  if (isOutboundEcho(payload)) {
    res.status(200).json({ ok: true });
    return;
  }

  const normalizedPhone = normalizePhone(from);

  // Query doctors in this clinic (LIMIT 3 to detect multi-doctor without fetching all).
  const doctorResult = await pool.query(
    `SELECT id, name FROM users WHERE clinic_id = $1 AND role = 'doctor' AND deleted_at IS NULL ORDER BY name LIMIT 3`,
    [clinicId]
  );

  if (doctorResult.rows.length === 0) {
    res.status(200).json({ ok: true });
    return;
  }

  // Single doctor: route directly (common case).
  if (doctorResult.rows.length === 1) {
    const doctorId = doctorResult.rows[0].id;
    await handleSessionFlow(clinicId, doctorId, normalizedPhone, messageBody);
    res.status(200).json({ ok: true });
    return;
  }

  // Multiple doctors: doctor-picker flow.
  // Check if patient already has an active session (they've already picked a doctor).
  for (const doc of doctorResult.rows) {
    const active = await repo.findActiveSession(doc.id, normalizedPhone);
    if (active) {
      // Resume existing session regardless of doctor count.
      try {
        if (active.status === 'completed' || active.status === 'error') {
          await service.startSession({
            doctorId: doc.id,
            patientId: null,
            channel: 'whatsapp',
            channelSessionId: normalizedPhone,
            triggerType: 'book',
          });
        } else {
          await service.resumeSession({
            sessionId: active.id,
            doctorId: doc.id,
            channelSessionId: normalizedPhone,
            input: messageBody,
          });
        }
      } catch (err) {
        console.error('[WhatsAppWebhook] Error resuming session:', err);
      }
      res.status(200).json({ ok: true });
      return;
    }
  }

  // No active session - check if message is a doctor selection number.
  const selection = parseInt(messageBody.trim(), 10);
  if (!isNaN(selection) && selection >= 1 && selection <= doctorResult.rows.length) {
    const selectedDoctor = doctorResult.rows[selection - 1];
    await handleSessionFlow(clinicId, selectedDoctor.id, normalizedPhone, messageBody);
    res.status(200).json({ ok: true });
    return;
  }

  // Not a valid selection - send doctor picker prompt.
  const doctorList = doctorResult.rows
    .map((doc, i) => `${i + 1}. ${doc.name}`)
    .join('\n');
  const prompt = `Please select a doctor by replying with a number:\n\n${doctorList}\n\nReply with 1-${doctorResult.rows.length}.`;

  try {
    await whatsapp.sendMessage({
      to: normalizedPhone,
      content: prompt,
      clinicId,
    });
  } catch (err) {
    console.error('[WhatsAppWebhook] Error sending doctor picker:', err);
  }

  res.status(200).json({ ok: true });
}

async function handleSessionFlow(
  clinicId: string,
  doctorId: string,
  phone: string,
  messageBody: string
) {
  try {
    const activeSession = await repo.findActiveSession(doctorId, phone);

    if (activeSession) {
      if (activeSession.status === 'completed' || activeSession.status === 'error') {
        await service.startSession({
          doctorId,
          patientId: null,
          channel: 'whatsapp',
          channelSessionId: phone,
          triggerType: 'book',
        });
        return;
      }

      await service.resumeSession({
        sessionId: activeSession.id,
        doctorId,
        channelSessionId: phone,
        input: messageBody,
      });
      return;
    }

    await service.startSession({
      doctorId,
      patientId: null,
      channel: 'whatsapp',
      channelSessionId: phone,
      triggerType: 'book',
    });
  } catch (err) {
    console.error('[WhatsAppWebhook] Error in session flow:', err);
  }
}
