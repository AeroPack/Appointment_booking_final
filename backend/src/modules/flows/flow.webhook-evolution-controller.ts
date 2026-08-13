import type { Request, Response } from 'express';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowSessionService } from './flow.session-service.js';
import { evolutionService } from '../doctors/evolution.service.js';
import pool from '../../config/db.js';
import { normalizePhone } from '../../utils/phone.js';

const repo = new FlowSessionRepository();
const service = new FlowSessionService(repo);

interface EvolutionInboundMessage {
  id: string;
  from: string;
  input: string;
}

function extractMessages(body: unknown): EvolutionInboundMessage[] {
  const out: EvolutionInboundMessage[] = [];
  const event = (body as { event?: string })?.event;

  if (event?.toLowerCase() !== 'messages.upsert') return out;

  const data = (body as { data?: Record<string, unknown> })?.data;
  if (!data) return out;

  const key = data['key'] as Record<string, unknown> | undefined;
  if (!key) return out;

  const fromMe = key['fromMe'] as boolean | undefined;
  if (fromMe) return out;

  const remoteJid = key['remoteJid'] as string | undefined;
  const id = key['id'] as string | undefined;
  if (!remoteJid || !id) return out;

  const phone = String(remoteJid).replace('@s.whatsapp.net', '');

  const message = data['message'] as Record<string, unknown> | undefined;
  if (!message) return out;

  let input: string | null = null;

  if (message['conversation']) {
    input = String(message['conversation']);
  } else if (message['extendedTextMessage']) {
    const ext = message['extendedTextMessage'] as Record<string, unknown>;
    input = String(ext['text'] || '');
  } else if (message['buttonsResponseMessage']) {
    const btn = message['buttonsResponseMessage'] as Record<string, unknown>;
    input = String(btn['selectedButtonId'] || btn['displayText'] || '');
  } else if (message['listResponseMessage']) {
    const list = message['listResponseMessage'] as Record<string, unknown>;
    const single = list['singleSelectReply'] as Record<string, unknown> | undefined;
    input = String(single?.['selectedRowId'] || '');
  }

  if (!input) return out;

  out.push({
    id,
    from: normalizePhone(phone),
    input: input.trim(),
  });

  return out;
}

async function claimMessage(messageId: string): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO whatsapp_inbound_messages (message_id) VALUES ($1)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING message_id`,
    [messageId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function handleEvolutionWebhook(req: Request, res: Response) {
  res.status(200).json({ ok: true });

  const instanceName = req.params['instanceName'] as string;
  if (!instanceName) return;

  const doctorId = await evolutionService.getDoctorIdByInstance(instanceName);
  if (!doctorId) {
    console.error(`[EvolutionWebhook] No doctor found for instance: ${instanceName}`);
    return;
  }

  const messages = extractMessages(req.body);
  if (messages.length === 0) return;

  for (const message of messages) {
    try {
      if (!(await claimMessage(message.id))) continue;
      await handleSessionFlow(doctorId, message.from, message.input);
    } catch (err) {
      console.error('[EvolutionWebhook] Error handling message:', err);
    }
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
