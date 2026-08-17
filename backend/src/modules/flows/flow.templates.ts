import pool from '../../config/db.js';

interface TemplateDef {
  templateType: string;
  subject: string | null;
  content: string;
  offsetMinutes: number | null;
  channel: string;
}

interface FlowDef {
  name: string;
  triggerType: string;
  graph: { nodes: any[]; edges: any[] };
}

const REMINDER_TEMPLATES: TemplateDef[] = [
  {
    templateType: 'reminder',
    subject: 'Appointment Reminder - 24 Hours',
    content: 'Dear {{patient_name}}, this is a reminder that your appointment with Dr. {{doctor_name}} is scheduled for {{slot_time}} at {{venue}}. Token: #{{token_number}}. Please arrive 10 minutes early.',
    offsetMinutes: 1440,
    channel: 'whatsapp',
  },
  {
    templateType: 'reminder',
    subject: 'Appointment Reminder - 1 Hour',
    content: 'Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} starts in 1 hour at {{slot_time}}. Please head to {{venue}}. Token: #{{token_number}}.',
    offsetMinutes: 60,
    channel: 'whatsapp',
  },
];

const BOOKING_TEMPLATE: TemplateDef = {
  templateType: 'booking_confirmation',
  subject: 'Appointment Confirmed',
  content: 'Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} has been confirmed for {{slot_time}} at {{venue}}. Token: #{{token_number}}. Thank you for booking with {{clinic_name}}!',
  offsetMinutes: null,
  channel: 'whatsapp',
};

const CANCELLATION_TEMPLATE: TemplateDef = {
  templateType: 'appointment_cancelled',
  subject: 'Appointment Cancelled',
  content: 'Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} scheduled for {{slot_time}} has been cancelled. If this was a mistake, please contact {{clinic_name}} to rebook.',
  offsetMinutes: null,
  channel: 'whatsapp',
};

function makeNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildBookingConfirmationFlow(templateId: string): FlowDef {
  const startId = makeNodeId();
  const templateNodeId = makeNodeId();
  const endId = makeNodeId();

  return {
    name: 'Booking Confirmation',
    triggerType: 'booking_confirmed',
    graph: {
      nodes: [
        { id: startId, type: 'start', position: { x: 250, y: 50 }, data: {} },
        { id: templateNodeId, type: 'template', position: { x: 250, y: 150 }, data: { template_id: templateId } },
        { id: endId, type: 'end', position: { x: 250, y: 250 }, data: { message: 'Flow complete' } },
      ],
      edges: [
        { id: `edge_${startId}_${templateNodeId}`, source: startId, target: templateNodeId },
        { id: `edge_${templateNodeId}_${endId}`, source: templateNodeId, target: endId },
      ],
    },
  };
}

function buildReminderFlow(templateId: string, offsetMinutes: number, name: string): FlowDef {
  const startId = makeNodeId();
  const delayId = makeNodeId();
  const templateNodeId = makeNodeId();
  const endId = makeNodeId();

  return {
    name,
    triggerType: 'reminder',
    graph: {
      nodes: [
        { id: startId, type: 'start', position: { x: 250, y: 50 }, data: {} },
        { id: delayId, type: 'delay', position: { x: 250, y: 150 }, data: { offset_minutes: offsetMinutes, offset_from: 'appointment_start' } },
        { id: templateNodeId, type: 'template', position: { x: 250, y: 250 }, data: { template_id: templateId } },
        { id: endId, type: 'end', position: { x: 250, y: 350 }, data: { message: 'Flow complete' } },
      ],
      edges: [
        { id: `edge_${startId}_${delayId}`, source: startId, target: delayId },
        { id: `edge_${delayId}_${templateNodeId}`, source: delayId, target: templateNodeId },
        { id: `edge_${templateNodeId}_${endId}`, source: templateNodeId, target: endId },
      ],
    },
  };
}

function buildCancellationFlow(templateId: string): FlowDef {
  const startId = makeNodeId();
  const templateNodeId = makeNodeId();
  const endId = makeNodeId();

  return {
    name: 'Cancellation Notice',
    triggerType: 'appointment_cancelled',
    graph: {
      nodes: [
        { id: startId, type: 'start', position: { x: 250, y: 50 }, data: {} },
        { id: templateNodeId, type: 'template', position: { x: 250, y: 150 }, data: { template_id: templateId } },
        { id: endId, type: 'end', position: { x: 250, y: 250 }, data: { message: 'Flow complete' } },
      ],
      edges: [
        { id: `edge_${startId}_${templateNodeId}`, source: startId, target: templateNodeId },
        { id: `edge_${templateNodeId}_${endId}`, source: templateNodeId, target: endId },
      ],
    },
  };
}

async function findOrCreateTemplate(
  clinicId: string,
  doctorId: string,
  def: TemplateDef,
): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM message_templates
     WHERE clinic_id = $1 AND doctor_id = $2 AND template_type = $3
       AND ($4::int IS NULL AND offset_minutes IS NULL OR offset_minutes = $4::int)
     LIMIT 1`,
    [clinicId, doctorId, def.templateType, def.offsetMinutes],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const result = await pool.query(
    `INSERT INTO message_templates (clinic_id, doctor_id, template_type, subject, content, offset_minutes, channel)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [clinicId, doctorId, def.templateType, def.subject, def.content, def.offsetMinutes, def.channel],
  );
  return result.rows[0].id;
}

async function findOrCreateFlow(
  doctorId: string,
  name: string,
  triggerType: string,
  graph: { nodes: any[]; edges: any[] },
): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM flows WHERE doctor_id = $1 AND trigger_type = $2 AND is_active = true LIMIT 1`,
    [doctorId, triggerType],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const flowResult = await pool.query(
    `INSERT INTO flows (doctor_id, name, trigger_type) VALUES ($1, $2, $3) RETURNING id`,
    [doctorId, name, triggerType],
  );
  const flowId = flowResult.rows[0].id;

  const versionResult = await pool.query(
    `INSERT INTO flow_versions (flow_id, version_number, status, graph, created_by)
     VALUES ($1, 1, 'draft', $2, $3) RETURNING id`,
    [flowId, JSON.stringify(graph), doctorId],
  );
  const versionId = versionResult.rows[0].id;

  await pool.query(
    `UPDATE flow_versions SET status = 'published', published_at = NOW() WHERE id = $1`,
    [versionId],
  );
  await pool.query(
    `UPDATE flows SET published_version_id = $1 WHERE id = $2`,
    [versionId, flowId],
  );

  return flowId;
}

export async function seedDefaultFlowsForDoctor(doctorId: string): Promise<void> {
  const clinicResult = await pool.query(
    `SELECT clinic_id FROM users WHERE id = $1`,
    [doctorId],
  );
  const clinicId = clinicResult.rows[0]?.clinic_id;
  if (!clinicId) return;

  const confirmTemplateId = await findOrCreateTemplate(clinicId, doctorId, BOOKING_TEMPLATE);
  const confirmFlow = buildBookingConfirmationFlow(confirmTemplateId);
  await findOrCreateFlow(
    doctorId,
    confirmFlow.name,
    confirmFlow.triggerType,
    confirmFlow.graph,
  );

  for (const tmpl of REMINDER_TEMPLATES) {
    const tmplId = await findOrCreateTemplate(clinicId, doctorId, tmpl);
    const reminderFlow = buildReminderFlow(tmplId, tmpl.offsetMinutes!, tmpl.offsetMinutes! >= 1440 ? '24h Reminder' : '1h Reminder');
    await findOrCreateFlow(
      doctorId,
      reminderFlow.name,
      reminderFlow.triggerType,
      reminderFlow.graph,
    );
  }

  const cancelTemplateId = await findOrCreateTemplate(clinicId, doctorId, CANCELLATION_TEMPLATE);
  const cancelFlow = buildCancellationFlow(cancelTemplateId);
  await findOrCreateFlow(
    doctorId,
    cancelFlow.name,
    cancelFlow.triggerType,
    cancelFlow.graph,
  );
}
