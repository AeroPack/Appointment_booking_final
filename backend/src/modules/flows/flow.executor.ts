import type { FlowGraph, FlowNodeType } from './flow.node-schemas.js';
import type { FlowSessionRow, FlowSessionRepository } from './flow.session-repository.js';
import { sendMessage } from '../../utils/channels/index.js';
import pool from '../../config/db.js';
import { AppError } from '../../utils/response.js';

const MAX_STEPS = 100;

export type NodeResult =
  | { action: 'advance'; nextNodeId: string }
  | { action: 'wait' }
  | { action: 'complete' }
  | { action: 'error'; message: string };

export class FlowExecutor {
  constructor(private readonly sessionRepo: FlowSessionRepository) {}

  async executeTurn(session: FlowSessionRow, graph: FlowGraph): Promise<FlowSessionRow> {
    if (session.status === 'completed' || session.status === 'error' || session.status === 'expired') {
      return session;
    }

    await this.sessionRepo.updateSessionStatus(session.id, 'running');

    let currentNodeId = session.current_node_id || this.findStartNodeId(graph);
    if (!currentNodeId) {
      await this.sessionRepo.updateSessionStatus(session.id, 'error', {
        errorMessage: 'Flow has no start node',
      });
      return { ...session, status: 'error', error_message: 'Flow has no start node' };
    }

    let context = { ...session.context };
    let stepCount = session.step_count;

    while (stepCount < MAX_STEPS) {
      const node = graph.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          currentNodeId,
          errorMessage: `Node "${currentNodeId}" not found in graph`,
        });
        return { ...session, status: 'error', error_message: `Node "${currentNodeId}" not found in graph` };
      }

      const result = await this.handleNode(
        { ...node, type: node.type as FlowNodeType },
        graph.edges,
        context,
        session,
      );

      if (result.action === 'advance') {
        currentNodeId = result.nextNodeId;
        stepCount = await this.sessionRepo.incrementStepCount(session.id);
        continue;
      }

      if (result.action === 'wait') {
        await this.sessionRepo.updateSessionStatus(session.id, 'waiting_input', {
          currentNodeId,
          context,
        });
        return { ...session, status: 'waiting_input', current_node_id: currentNodeId, context, step_count: stepCount };
      }

      if (result.action === 'complete') {
        await this.sessionRepo.updateSessionStatus(session.id, 'completed', {
          currentNodeId,
          context,
        });
        return { ...session, status: 'completed', current_node_id: currentNodeId, context, step_count: stepCount };
      }

      if (result.action === 'error') {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          currentNodeId,
          errorMessage: result.message,
          context,
        });
        return { ...session, status: 'error', current_node_id: currentNodeId, error_message: result.message, context, step_count: stepCount };
      }
    }

    await this.sessionRepo.updateSessionStatus(session.id, 'error', {
      currentNodeId,
      errorMessage: `Flow exceeded maximum steps (${MAX_STEPS})`,
      context,
    });
    return { ...session, status: 'error', current_node_id: currentNodeId, error_message: `Flow exceeded maximum steps (${MAX_STEPS})`, context, step_count: stepCount };
  }

  async handleInput(session: FlowSessionRow, graph: FlowGraph, input: string): Promise<FlowSessionRow> {
    if (session.status !== 'waiting_input') {
      throw new AppError(400, 'INVALID_STATE', 'Session is not waiting for input');
    }

    const node = graph.nodes.find(n => n.id === session.current_node_id);
    if (!node) {
      await this.sessionRepo.updateSessionStatus(session.id, 'error', {
        errorMessage: `Node "${session.current_node_id}" not found`,
      });
      return { ...session, status: 'error' };
    }

    if (node.type === 'choice') {
      const resolved = this.resolveChoiceInput(input, node.data.options as Array<{ id: string; label: string; value: string }>);
      if (!resolved) {
        await this.sessionRepo.addMessage({
          sessionId: session.id,
          direction: 'outbound',
          nodeId: node.id,
          content: `Invalid selection. Please choose a valid option.\n${node.data.text}\n${(node.data.options as Array<{ label: string }>).map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`,
          messageType: 'choice',
        });
        return session;
      }

      const context = { ...session.context, [node.id]: resolved.value };
      const handle = `option:${resolved.id}`;
      const edge = graph.edges.find(e => e.source === node.id && e.sourceHandle === handle);

      if (!edge) {
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          errorMessage: `No edge found for handle "${handle}"`,
        });
        return { ...session, status: 'error' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: input,
        messageType: 'text',
      });

      session.current_node_id = edge.target;
      session.context = context;
      session.step_count = await this.sessionRepo.incrementStepCount(session.id);
      return this.executeTurn(session, graph);
    }

    if (node.type === 'api' && node.data._clientResponse !== undefined) {
      const resp = node.data._clientResponse as { status?: number; data?: unknown; error?: string };
      const apiResponse = { status: resp.status, data: resp.data, error: resp.error };
      const context = { ...session.context, api_response: apiResponse };

      const isSuccess = resp.status !== undefined && resp.status >= 200 && resp.status < 300;
      const handle = isSuccess ? 'success' : 'error';
      const edge = graph.edges.find(e => e.source === node.id && e.sourceHandle === handle);

      if (!edge) {
        const fallbackEdge = graph.edges.find(e => e.source === node.id);
        if (fallbackEdge) {
          session.current_node_id = fallbackEdge.target;
          session.context = context;
          session.step_count = await this.sessionRepo.incrementStepCount(session.id);
          return this.executeTurn(session, graph);
        }
        await this.sessionRepo.updateSessionStatus(session.id, 'error', {
          errorMessage: `No edge found for handle "${handle}" and no fallback`,
        });
        return { ...session, status: 'error' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'inbound',
        nodeId: node.id,
        content: JSON.stringify(resp),
        messageType: 'api_response',
      });

      session.current_node_id = edge.target;
      session.context = context;
      session.step_count = await this.sessionRepo.incrementStepCount(session.id);
      return this.executeTurn(session, graph);
    }

    await this.sessionRepo.addMessage({
      sessionId: session.id,
      direction: 'inbound',
      nodeId: node.id,
      content: input,
      messageType: 'text',
    });

    return session;
  }

  private async handleNode(
    node: { id: string; type: FlowNodeType; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    context: Record<string, unknown>,
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    switch (node.type) {
      case 'start':
        return this.handleStart(node, edges);
      case 'message':
        return this.handleMessage(node, edges, session);
      case 'choice':
        return this.handleChoice(node, session);
      case 'condition':
        return this.handleCondition(node, edges, context);
      case 'api':
        return this.handleApi(node, edges, session);
      case 'booking_action':
        return this.handleBookingAction(node, edges, context, session);
      case 'end':
        return this.handleEnd(node, session);
      default:
        return { action: 'error', message: `Unknown node type: ${node.type}` };
    }
  }

  private handleStart(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
  ): NodeResult {
    const edge = edges.find(e => e.source === node.id);
    if (!edge) return { action: 'error', message: 'Start node has no outgoing edge' };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleMessage(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const text = String(node.data.text || '');
    await this.sendOutbound(session, text, 'text', node.id);
    const edge = edges.find(e => e.source === node.id);
    if (!edge) return { action: 'complete' };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleChoice(
    node: { id: string; data: Record<string, unknown> },
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const text = String(node.data.text || '');
    const options = (node.data.options as Array<{ id: string; label: string }>) || [];
    const numbered = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const fullText = `${text}\n\n${numbered}`;
    await this.sendOutbound(session, fullText, 'choice', node.id);
    return { action: 'wait' };
  }

  private handleCondition(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    context: Record<string, unknown>,
  ): NodeResult {
    const variable = String(node.data.variable || '');
    const operator = String(node.data.operator || 'equals');
    const value = node.data.value !== undefined ? String(node.data.value) : undefined;

    const actual = context[variable];
    const result = this.evaluateCondition(actual, operator, value);
    const handle = result ? 'true' : 'false';
    const edge = edges.find(e => e.source === node.id && e.sourceHandle === handle);

    if (!edge) return { action: 'error', message: `Condition node missing "${handle}" branch` };
    return { action: 'advance', nextNodeId: edge.target };
  }

  private async handleApi(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const url = String(node.data.url || '');
    const method = (node.data.method as string) || 'GET';

    try {
      const axios = (await import('axios')).default;
      const response = await axios({
        method: method.toLowerCase() as 'get' | 'post',
        url,
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiResponse = { status: response.status, data: response.data };
      const contextKey = `api_response`;
      const context = { [contextKey]: apiResponse };

      const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'success');
      if (!edge) {
        const fallback = edges.find(e => e.source === node.id);
        if (fallback) return { action: 'advance', nextNodeId: fallback.target };
        return { action: 'error', message: 'API node has no outgoing edge' };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'outbound',
        nodeId: node.id,
        content: JSON.stringify(apiResponse),
        messageType: 'api_response',
      });

      Object.assign(session.context, context);
      return { action: 'advance', nextNodeId: edge.target };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      const apiResponse = { error };
      const context = { api_response: apiResponse };

      const edge = edges.find(e => e.source === node.id && e.sourceHandle === 'error');
      if (!edge) {
        const fallback = edges.find(e => e.source === node.id);
        if (fallback) {
          Object.assign(session.context, context);
          return { action: 'advance', nextNodeId: fallback.target };
        }
        return { action: 'error', message: `API call failed: ${error}` };
      }

      await this.sessionRepo.addMessage({
        sessionId: session.id,
        direction: 'outbound',
        nodeId: node.id,
        content: JSON.stringify(apiResponse),
        messageType: 'api_response',
      });

      Object.assign(session.context, context);
      return { action: 'advance', nextNodeId: edge.target };
    }
  }

  private async handleBookingAction(
    node: { id: string; data: Record<string, unknown> },
    edges: FlowGraph['edges'],
    context: Record<string, unknown>,
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    const required = ['patient_name', 'patient_phone', 'slot_start'];
    const missing = required.filter(k => !context[k] || String(context[k]).trim() === '');

    if (missing.length > 0) {
      const msg = `Missing required information: ${missing.join(', ')}`;
      await this.sendOutbound(session, msg, 'text', node.id);
      return { action: 'error', message: msg };
    }

    try {
      const doctorId = session.doctor_id;
      const clinicId = await this.sessionRepo.findDoctorClinicId(doctorId);
      if (!clinicId) throw new Error('Doctor not associated with any clinic');

      const scheduledStart = new Date(String(context.slot_start));
      if (isNaN(scheduledStart.getTime()) || scheduledStart <= new Date()) {
        throw new Error('Invalid or past slot_start');
      }

      const ist = this.toIST(scheduledStart);
      const slotMin = ist.hours * 60 + ist.minutes;

      const settingsResult = await pool.query(
        `SELECT s.*, v.name AS venue_name
         FROM appointment_settings s
         LEFT JOIN venues v ON v.id = s.venue_id
         WHERE s.doctor_id = $1 AND s.day_of_week = $2 AND s.is_active = true
         ORDER BY s.start_time`,
        [doctorId, ist.dayOfWeek]
      );
      const periods = settingsResult.rows;
      if (periods.length === 0) throw new Error('Doctor has no active settings for this day');

      const matching = periods.find((p: Record<string, unknown>) => {
        const start = this.toMinutes(String(p.start_time));
        const end = this.toMinutes(String(p.end_time));
        return slotMin >= start && (slotMin + Number(p.slot_duration_minutes)) <= end;
      });
      if (!matching) throw new Error('Slot does not fall within an active period');

      const periodStart = this.toMinutes(String(matching.start_time));
      if ((slotMin - periodStart) % Number(matching.slot_duration_minutes) !== 0) {
        throw new Error('Slot time must align with the slot grid');
      }

      const scheduledEnd = new Date(scheduledStart.getTime() + Number(matching.slot_duration_minutes) * 60 * 1000);

      const bookedResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM appointments
         WHERE doctor_id = $1 AND scheduled_start >= $2 AND scheduled_start < $3
         AND appointment_status IN ('booked', 'finished') AND deleted_at IS NULL`,
        [doctorId, scheduledStart, scheduledEnd]
      );
      if (bookedResult.rows[0].count >= Number(matching.max_patients_per_slot)) {
        throw new Error('This slot is fully booked');
      }

      let patientResult = await pool.query(
        `SELECT id, name FROM users WHERE mobile_number = $1 AND role = 'patient' AND deleted_at IS NULL LIMIT 1`,
        [String(context.patient_phone)]
      );
      let patientId: string;
      if (patientResult.rows[0]) {
        patientId = patientResult.rows[0].id;
      } else {
        patientResult = await pool.query(
          `INSERT INTO users (name, mobile_number, clinic_id, role) VALUES ($1, $2, $3, 'patient') RETURNING id`,
          [String(context.patient_name), String(context.patient_phone), clinicId]
        );
        patientId = patientResult.rows[0].id;
      }

      const dateStr = this.formatDate(scheduledStart);
      const tokenResult = await pool.query(
        `SELECT COALESCE(MAX(token_number), 0) + 1 AS next FROM appointments
         WHERE doctor_id = $1 AND (scheduled_start AT TIME ZONE 'Asia/Kolkata')::date = $2`,
        [doctorId, dateStr]
      );
      const tokenNumber = tokenResult.rows[0].next;

      const idempotencyKey = `flow:${session.id}:${node.id}`;
      const existing = await pool.query(
        `SELECT appointment_id FROM booking_idempotency WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows[0]) {
        const apptResult = await pool.query(
          `SELECT id, token_number, scheduled_start, scheduled_end FROM appointments WHERE id = $1`,
          [existing.rows[0].appointment_id]
        );
        const appt = apptResult.rows[0];
        const appointment = {
          appointment_id: appt.id,
          token_number: appt.token_number,
          scheduled_start: appt.scheduled_start,
          scheduled_end: appt.scheduled_end,
        };
        context.appointment = appointment;
        const edge = edges.find(e => e.source === node.id);
        if (edge) return { action: 'advance', nextNodeId: edge.target };
        return { action: 'complete' };
      }

      const insertResult = await pool.query(
        `INSERT INTO appointments (clinic_id, doctor_id, patient_id, booked_by_user_id, venue_id, scheduled_start, scheduled_end, token_number, appointment_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          clinicId, doctorId, patientId, doctorId,
          matching.venue_id || null, scheduledStart, scheduledEnd,
          tokenNumber, context.appointment_type || 'checkup',
          context.reason || null,
        ]
      );
      const appointmentId = insertResult.rows[0].id;

      await pool.query(
        `INSERT INTO booking_idempotency (idempotency_key, appointment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [idempotencyKey, appointmentId]
      );

      const doctorInfoResult = await pool.query(
        `SELECT name FROM users WHERE id = $1`,
        [doctorId]
      );

      const appointment = {
        appointment_id: appointmentId,
        token_number: tokenNumber,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        doctor_name: doctorInfoResult.rows[0]?.name || 'Doctor',
        patient_name: String(context.patient_name),
      };

      context.appointment = appointment;

      const confirmMsg = `Appointment booked successfully!\nToken: #${tokenNumber}\nDoctor: ${appointment.doctor_name}\nDate: ${appointment.scheduled_start}\nThank you, ${appointment.patient_name}!`;
      await this.sendOutbound(session, confirmMsg, 'text', node.id);

      const edge = edges.find(e => e.source === node.id);
      if (edge) return { action: 'advance', nextNodeId: edge.target };
      return { action: 'complete' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed';
      context.booking_error = msg;
      await this.sendOutbound(session, `Booking failed: ${msg}`, 'text', node.id);
      return { action: 'error', message: msg };
    }
  }

  private async handleEnd(
    node: { id: string; data: Record<string, unknown> },
    session: FlowSessionRow,
  ): Promise<NodeResult> {
    if (node.data.message) {
      await this.sendOutbound(session, String(node.data.message), 'text', node.id);
    }
    return { action: 'complete' };
  }

  private evaluateCondition(
    actual: unknown,
    operator: string,
    expected: string | undefined,
  ): boolean {
    const str = actual !== undefined && actual !== null ? String(actual) : '';
    switch (operator) {
      case 'equals': return str === (expected || '');
      case 'not_equals': return str !== (expected || '');
      case 'contains': return str.includes(expected || '');
      case 'exists': return actual !== undefined && actual !== null && actual !== '';
      default: return false;
    }
  }

  private resolveChoiceInput(
    input: string,
    options: Array<{ id: string; label: string; value: string }>,
  ): { id: string; label: string; value: string } | null {
    const trimmed = input.trim();

    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return options[num - 1];
    }

    const lower = trimmed.toLowerCase();
    for (const opt of options) {
      if (opt.value.toLowerCase() === lower) return opt;
    }
    for (const opt of options) {
      if (opt.label.toLowerCase() === lower) return opt;
    }

    return null;
  }

  private findStartNodeId(graph: FlowGraph): string | null {
    const startNode = graph.nodes.find(n => n.type === 'start');
    return startNode?.id || null;
  }

  private async sendOutbound(
    session: FlowSessionRow,
    content: string,
    messageType: 'text' | 'choice',
    nodeId: string,
  ): Promise<void> {
    await this.sessionRepo.addMessage({
      sessionId: session.id,
      direction: 'outbound',
      nodeId,
      content,
      messageType,
    });

    if (session.channel === 'whatsapp' && session.channel_session_id) {
      const clinicId = await this.sessionRepo.findDoctorClinicId(session.doctor_id);
      if (clinicId) {
        try {
          await sendMessage({
            to: session.channel_session_id,
            content,
            clinicId,
            channel: 'whatsapp',
          });
        } catch (err) {
          console.error('[FlowExecutor] Failed to send WhatsApp message:', err);
        }
      }
    }
  }

  private toIST(date: Date): { hours: number; minutes: number; dayOfWeek: number } {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 3600000);
    return {
      hours: ist.getHours(),
      minutes: ist.getMinutes(),
      dayOfWeek: ((ist.getDay() + 6) % 7) + 1,
    };
  }

  private toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  private formatDate(date: Date): string {
    const ist = new Date(date.getTime() + 5.5 * 3600000);
    return ist.toISOString().split('T')[0];
  }
}
