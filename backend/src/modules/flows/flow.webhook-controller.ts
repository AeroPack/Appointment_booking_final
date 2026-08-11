import type { Request, Response } from 'express';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowSessionService } from './flow.session-service.js';
import { sendMessage } from '../../utils/channels/index.js';
import pool from '../../config/db.js';
import { normalizePhone } from '../../utils/phone.js';

const repo = new FlowSessionRepository();
const service = new FlowSessionService(repo);

/**
 * One inbound WhatsApp message, reduced to what the flow engine needs.
 */
interface InboundMessage {
  /** Provider message id, used to reject Meta's redeliveries. */
  id: string;
  /** Sender in canonical digits-with-country-code form. */
  from: string;
  /**
   * What the patient "said". For taps this is the option *id* rather than the
   * visible label, which is what lets the slot picker recover an exact
   * timestamp from a row the patient selected.
   */
  input: string;
}

/**
 * Meta's webhook verification handshake.
 *
 * Called once when the callback URL is saved in the Meta dashboard. The
 * challenge must come back as a bare string - a JSON-wrapped response fails
 * verification.
 */
export function verifyWhatsAppWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env['WA_CLOUD_VERIFY_TOKEN'];

  if (mode === 'subscribe' && expected && token === expected) {
    res.status(200).type('text/plain').send(String(challenge ?? ''));
    return;
  }

  res.sendStatus(403);
}

/**
 * Pull the messages out of a Cloud API delivery.
 *
 * A delivery may carry `statuses` (sent/delivered/read receipts for our own
 * outbound messages) instead of `messages`. Treating those as inbound text is
 * the classic way this integration starts replying to itself, so entries
 * without a `messages` array are skipped.
 *
 * @param body - Parsed webhook body
 * @returns Every patient-authored message in the delivery
 */
export function extractMessages(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const raw of messages) {
        const message = raw as Record<string, any>;
        const input = readInput(message);
        if (!message.id || !message.from || input === null) continue;

        out.push({
          id: String(message.id),
          from: normalizePhone(String(message.from)),
          input,
        });
      }
    }
  }

  return out;
}

/**
 * Reduce a message of any supported type to the string the executor consumes.
 * @param message - One element of `value.messages`
 * @returns The input string, or null for types the flow cannot act on
 */
function readInput(message: Record<string, any>): string | null {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? null;

    case 'interactive': {
      // Reply buttons and list rows arrive under different keys but both
      // carry the id we put on the option.
      const interactive = message.interactive;
      return interactive?.button_reply?.id ?? interactive?.list_reply?.id ?? null;
    }

    case 'button':
      // Quick-reply button on an approved template.
      return message.button?.payload ?? message.button?.text ?? null;

    default:
      // Images, audio, location, reactions, and so on: nothing the booking
      // flow can use. Ignored rather than fed in as garbage input.
      return null;
  }
}

/**
 * Claim a provider message id so a redelivery cannot be processed twice.
 *
 * Meta retries any delivery it does not see a prompt 2xx for, and duplicate
 * processing means a duplicate appointment. The insert is the claim: only the
 * first caller gets a row back, so concurrent retries resolve correctly where
 * a SELECT-then-process check would not.
 *
 * @param messageId - Provider message id
 * @returns True if this call owns the message, false if it was already seen
 */
async function claimMessage(messageId: string): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO whatsapp_inbound_messages (message_id) VALUES ($1)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING message_id`,
    [messageId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function handleWhatsAppWebhook(req: Request, res: Response) {
  // Clinic is already validated by whatsappWebhookAuth middleware.
  const clinicId = req.webhookClinicId!;

  // Acknowledge before doing any work. Meta retries on anything slow or
  // non-2xx, and the retry would duplicate the conversation.
  res.status(200).json({ ok: true });

  const messages = extractMessages(req.body);
  if (messages.length === 0) return;

  for (const message of messages) {
    try {
      if (!(await claimMessage(message.id))) continue;
      await routeMessage(clinicId, message);
    } catch (err) {
      console.error('[WhatsAppWebhook] Error handling message:', err);
    }
  }
}

/**
 * Pick the doctor this message belongs to, then run the flow.
 * @param clinicId - Clinic resolved from the webhook URL
 * @param message - The inbound message
 */
async function routeMessage(clinicId: string, message: InboundMessage) {
  // LIMIT 3 to detect multi-doctor without fetching all.
  const doctorResult = await pool.query(
    `SELECT id, name FROM users WHERE clinic_id = $1 AND role = 'doctor' AND deleted_at IS NULL ORDER BY name LIMIT 3`,
    [clinicId]
  );

  if (doctorResult.rows.length === 0) return;

  // Single doctor: route directly (common case).
  if (doctorResult.rows.length === 1) {
    await handleSessionFlow(doctorResult.rows[0].id, message.from, message.input);
    return;
  }

  // Multiple doctors: an existing session already records the choice.
  for (const doc of doctorResult.rows) {
    const active = await repo.findActiveSession(doc.id, message.from);
    if (active) {
      await handleSessionFlow(doc.id, message.from, message.input);
      return;
    }
  }

  // No active session - is this message a doctor selection?
  const selection = parseInt(message.input.trim(), 10);
  if (!isNaN(selection) && selection >= 1 && selection <= doctorResult.rows.length) {
    await handleSessionFlow(doctorResult.rows[selection - 1].id, message.from, message.input);
    return;
  }

  await sendDoctorPicker(clinicId, message.from, doctorResult.rows);
}

/**
 * Offer the clinic's doctors as tappable buttons.
 * @param clinicId - Clinic to send as
 * @param phone - Recipient
 * @param doctors - Candidate doctors (at most 3, matching Meta's button cap)
 */
async function sendDoctorPicker(
  clinicId: string,
  phone: string,
  doctors: Array<{ id: string; name: string }>
) {
  const numbered = doctors.map((doc, i) => `${i + 1}. ${doc.name}`).join('\n');

  try {
    await sendMessage({
      to: phone,
      channel: 'whatsapp',
      clinicId,
      content: `Please select a doctor:\n\n${numbered}\n\nReply with 1-${doctors.length}.`,
      options: {
        interactive: {
          kind: 'buttons',
          body: 'Which doctor would you like to see?',
          buttons: doctors.map((doc, i) => ({ id: String(i + 1), title: doc.name })),
        },
      },
    });
  } catch (err) {
    console.error('[WhatsAppWebhook] Error sending doctor picker:', err);
  }
}

async function handleSessionFlow(doctorId: string, phone: string, input: string) {
  const activeSession = await repo.findActiveSession(doctorId, phone);

  if (!activeSession) {
    await service.startSession({
      doctorId,
      patientId: null,
      channel: 'whatsapp',
      channelSessionId: phone,
      triggerType: 'book',
    });
    return;
  }

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
    input,
  });
}
