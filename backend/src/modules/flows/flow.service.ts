import { AppError } from '../../utils/response.js';
import { FlowRepository } from './flow.repository.js';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowExecutor } from './flow.executor.js';
import pool from '../../config/db.js';
import { NODE_DATA_SCHEMAS, flowGraphShapeSchema, type FlowGraph, type FlowNodeType, FLOW_NODE_TYPES } from './flow.node-schemas.js';

export class FlowService {
  constructor(private readonly repo: FlowRepository) {}

  async createFlow(doctorId: string, name: string, triggerType: string) {
    try {
      return await this.repo.createFlow(doctorId, name, triggerType);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new AppError(409, 'FLOW_ALREADY_EXISTS', 'A flow with this trigger type already exists for this doctor');
      }
      throw err;
    }
  }

  async listFlowsByDoctor(doctorId: string) {
    return this.repo.listFlowsByDoctor(doctorId);
  }

  async getFlowDetail(flowId: string, doctorId: string) {
    const flow = await this.repo.findFlowForDoctor(flowId, doctorId);
    if (!flow) throw new AppError(404, 'FLOW_NOT_FOUND', 'Flow not found');
    const versions = await this.repo.listVersions(flowId);
    return { flow, versions };
  }

  async getVersion(flowId: string, versionId: string, doctorId: string) {
    const flow = await this.repo.findFlowForDoctor(flowId, doctorId);
    if (!flow) throw new AppError(404, 'FLOW_NOT_FOUND', 'Flow not found');
    const version = await this.repo.findVersion(versionId, flowId);
    if (!version) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');
    return version;
  }

  async autosaveDraft(flowId: string, versionId: string, doctorId: string, graph: FlowGraph) {
    const flow = await this.repo.findFlowForDoctor(flowId, doctorId);
    if (!flow) throw new AppError(404, 'FLOW_NOT_FOUND', 'Flow not found');

    const structuralResult = flowGraphShapeSchema.safeParse(graph);
    if (!structuralResult.success) {
      const details = structuralResult.error.issues.map(
        (e) => `${String(e.path.join('.'))}: ${e.message}`
      );
      throw new AppError(422, 'INVALID_GRAPH_SHAPE', 'Graph shape is invalid', details);
    }

    const version = await this.repo.findVersion(versionId, flowId);
    if (!version) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');
    if (version.status !== 'draft') {
      throw new AppError(400, 'NOT_DRAFT', 'Can only autosave draft versions');
    }

    const updated = await this.repo.updateDraftGraph(versionId, graph);
    return { success: updated };
  }

  async getOrCreateDraft(flowId: string, doctorId: string) {
    const flow = await this.repo.findFlowForDoctor(flowId, doctorId);
    if (!flow) throw new AppError(404, 'FLOW_NOT_FOUND', 'Flow not found');

    const existingDraft = await this.repo.findDraftVersion(flowId);
    if (existingDraft) return existingDraft;

    const publishedVersion = await this.repo.findPublishedVersion(flowId);
    const graphToClone = publishedVersion?.graph;

    return this.repo.createDraftVersion(flowId, doctorId, graphToClone);
  }

  async publishVersion(flowId: string, versionId: string, doctorId: string) {
    const flow = await this.repo.findFlowForDoctor(flowId, doctorId);
    if (!flow) throw new AppError(404, 'FLOW_NOT_FOUND', 'Flow not found');

    const version = await this.repo.findVersion(versionId, flowId);
    if (!version) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');

    const errors = validateGraphForPublish(version.graph);
    if (errors.length > 0) {
      throw new AppError(422, 'INVALID_FLOW_GRAPH', 'Flow graph failed validation', errors);
    }

    await this.repo.publishVersion(flowId, versionId);
    return { success: true };
  }

  async rollbackToVersion(flowId: string, targetVersionId: string, doctorId: string) {
    const flow = await this.repo.findFlowForDoctor(flowId, doctorId);
    if (!flow) throw new AppError(404, 'FLOW_NOT_FOUND', 'Flow not found');

    const targetVersion = await this.repo.findVersion(targetVersionId, flowId);
    if (!targetVersion) throw new AppError(404, 'VERSION_NOT_FOUND', 'Target version not found');
    if (targetVersion.status !== 'archived') {
      throw new AppError(400, 'NOT_ARCHIVED', 'Can only rollback to an archived version');
    }

    await this.repo.rollbackToVersion(flowId, targetVersionId);
    return { success: true };
  }

  async triggerEvent(params: {
    doctorId: string;
    patientId: string;
    event: string;
    appointmentId: string;
  }) {
    const sessionRepo = new FlowSessionRepository();
    const flow = await sessionRepo.findPublishedFlowForDoctor(params.doctorId, params.event);
    if (!flow) return;

    const appointmentResult = await pool.query(
      `SELECT a.*, u.name AS patient_name, d.name AS doctor_name,
              v.name AS venue_name, c.name AS clinic_name
       FROM appointments a
       JOIN users u ON u.id = a.patient_id
       JOIN users d ON d.id = a.doctor_id
       LEFT JOIN venues v ON v.id = a.venue_id
       LEFT JOIN clinics c ON c.id = a.clinic_id
       WHERE a.id = $1`,
      [params.appointmentId]
    );
    const appt = appointmentResult.rows[0];
    if (!appt) return;

    const context: Record<string, unknown> = {
      patient_name: appt.patient_name,
      doctor_name: appt.doctor_name,
      slot_time: this.formatSlotTime(appt.scheduled_start),
      venue: appt.venue_name || 'Unknown',
      clinic_name: appt.clinic_name,
      token_number: appt.token_number != null ? String(appt.token_number) : '',
      appointment: {
        appointment_id: appt.id,
        token_number: appt.token_number,
        scheduled_start: appt.scheduled_start,
        scheduled_end: appt.scheduled_end,
      },
    };

    if (appt.whatsapp_number || appt.mobile_number) {
      context.patient_phone = appt.whatsapp_number || appt.mobile_number;
    }

    const session = await sessionRepo.createSession({
      flowId: flow.flowId,
      flowVersionId: flow.versionId,
      doctorId: params.doctorId,
      patientId: params.patientId,
      channel: 'whatsapp',
      channelSessionId: context.patient_phone ? String(context.patient_phone) : params.patientId,
      context,
    });

    const updatedSession = await sessionRepo.findSessionById(session.id);
    if (!updatedSession) return;

    const executor = new FlowExecutor(sessionRepo);
    await executor.executeTurn(updatedSession, flow.graph);
  }

  async scheduleReminders(params: {
    doctorId: string;
    patientId: string;
    appointmentId: string;
  }) {
    const sessionRepo = new FlowSessionRepository();
    const reminderFlows = await this.repo.findFlowsByTriggerType(params.doctorId, 'reminder');
    if (!reminderFlows || reminderFlows.length === 0) return;

    const appointmentResult = await pool.query(
      `SELECT a.*, u.name AS patient_name, d.name AS doctor_name,
              v.name AS venue_name, c.name AS clinic_name
       FROM appointments a
       JOIN users u ON u.id = a.patient_id
       JOIN users d ON d.id = a.doctor_id
       LEFT JOIN venues v ON v.id = a.venue_id
       LEFT JOIN clinics c ON c.id = a.clinic_id
       WHERE a.id = $1`,
      [params.appointmentId]
    );
    const appt = appointmentResult.rows[0];
    if (!appt) return;

    for (const flowRow of reminderFlows) {
      const graph = await sessionRepo.getFlowGraph(flowRow.version_id);
      if (!graph) continue;

      const delayNode = graph.nodes.find((n: { type: string }) => n.type === 'delay');
      if (!delayNode) continue;

      const offsetMinutes = Number(delayNode.data.offset_minutes || 0);
      const offsetFrom = String(delayNode.data.offset_from || 'appointment_start');
      const appointmentStart = new Date(appt.scheduled_start);
      const offsetMs = offsetMinutes * 60 * 1000;
      const executeAt = offsetFrom === 'appointment_end'
        ? new Date(appointmentStart.getTime() + offsetMs)
        : new Date(appointmentStart.getTime() - offsetMs);

      if (executeAt <= new Date()) continue;

      const context: Record<string, unknown> = {
        patient_name: appt.patient_name,
        doctor_name: appt.doctor_name,
        slot_time: this.formatSlotTime(appt.scheduled_start),
        venue: appt.venue_name || 'Unknown',
        clinic_name: appt.clinic_name,
        token_number: appt.token_number != null ? String(appt.token_number) : '',
        appointment: {
          appointment_id: appt.id,
          token_number: appt.token_number,
          scheduled_start: appt.scheduled_start,
          scheduled_end: appt.scheduled_end,
        },
      };

      if (appt.whatsapp_number || appt.mobile_number) {
        context.patient_phone = appt.whatsapp_number || appt.mobile_number;
      }

      const session = await sessionRepo.createSession({
        flowId: flowRow.flow_id,
        flowVersionId: flowRow.version_id,
        doctorId: params.doctorId,
        patientId: params.patientId,
        channel: 'whatsapp',
        channelSessionId: context.patient_phone ? String(context.patient_phone) : params.patientId,
        context,
      });

      const nextNodeId = this.findNextNodeAfterDelay(delayNode.id, graph);
      if (!nextNodeId) continue;

      await sessionRepo.insertScheduledExecution({
        sessionId: session.id,
        flowId: flowRow.flow_id,
        flowVersionId: flowRow.version_id,
        doctorId: params.doctorId,
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        currentNodeId: nextNodeId,
        context,
        executeAt,
      });
    }
  }

  private findNextNodeAfterDelay(delayNodeId: string, graph: FlowGraph): string | null {
    const edge = graph.edges.find((e: { source: string }) => e.source === delayNodeId);
    return edge?.target || null;
  }

  private formatSlotTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const offset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(d.getTime() + offset);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = ist.getUTCDate();
    const month = months[ist.getUTCMonth()];
    const year = ist.getUTCFullYear();
    const hours = ist.getUTCHours();
    const minutes = String(ist.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm} IST`;
  }
}

export function validateGraphForPublish(graph: FlowGraph): string[] {
  const errors: string[] = [];
  const { nodes, edges } = graph;

  const startNodes = nodes.filter((n: { type: string }) => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Flow must have exactly one Start node');
  } else if (startNodes.length > 1) {
    errors.push('Flow must have exactly one Start node (found ' + startNodes.length + ')');
  }

  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      duplicateNodeIds.add(node.id);
    }
    nodeIds.add(node.id);
  }
  if (duplicateNodeIds.size > 0) {
    errors.push('Duplicate node IDs: ' + Array.from(duplicateNodeIds).join(', '));
  }

  const edgeIds = new Set<string>();
  const duplicateEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      duplicateEdgeIds.add(edge.id);
    }
    edgeIds.add(edge.id);
  }
  if (duplicateEdgeIds.size > 0) {
    errors.push('Duplicate edge IDs: ' + Array.from(duplicateEdgeIds).join(', '));
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push('Edge "' + edge.id + '" references non-existent source node "' + edge.source + '"');
    }
    if (!nodeIds.has(edge.target)) {
      errors.push('Edge "' + edge.id + '" references non-existent target node "' + edge.target + '"');
    }
    if (edge.source === edge.target) {
      errors.push('Edge "' + edge.id + '" is a self-loop (source equals target)');
    }
  }

  const nodeMap = new Map(nodes.map((n: { id: string; type: string }) => [n.id, n]));

  const allowedSourceHandles: Record<string, string[] | null> = {
    start: null,
    message: null,
    template: null,
    choice: null,
    delay: null,
    api: ['success', 'error'],
    condition: ['true', 'false'],
    booking_action: null,
    end: null,
  };

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    if (!sourceNode) continue;

    const allowed = allowedSourceHandles[sourceNode.type as string];
    if (allowed !== null && edge.sourceHandle && !allowed.includes(edge.sourceHandle)) {
      errors.push(
        'Edge "' + edge.id + '" uses invalid sourceHandle "' + edge.sourceHandle + '" for ' + sourceNode.type + ' node (allowed: ' + allowed.join(', ') + ')'
      );
    }
  }

  for (const node of nodes) {
    if (node.type === 'choice') {
      const options = node.data.options;
      if (!Array.isArray(options)) continue;
      const optionIds = new Set(options.map((o: { id: string }) => o.id));
      const choiceEdges = edges.filter(
        (e: { source: string; sourceHandle?: string | null }) => e.source === node.id && e.sourceHandle
      );
      for (const edge of choiceEdges) {
        const handleId = edge.sourceHandle!;
        if (!handleId.startsWith('option:')) {
          errors.push('Choice node "' + node.id + '" edge "' + edge.id + '" sourceHandle must start with "option:"');
          continue;
        }
        const optionId = handleId.slice(7);
        if (!optionIds.has(optionId)) {
          errors.push('Choice node "' + node.id + '" edge "' + edge.id + '" references deleted option "' + optionId + '"');
        }
      }
    }

    if (node.type === 'condition') {
      const outgoing = edges.filter((e: { source: string }) => e.source === node.id);
      const handles = outgoing.map((e: { sourceHandle?: string | null }) => e.sourceHandle).filter(Boolean);
      if (!handles.includes('true') || !handles.includes('false')) {
        errors.push('Condition node "' + node.id + '" must have both "true" and "false" branches');
      }
    }

    if (node.type === 'api') {
      const outgoing = edges.filter((e: { source: string }) => e.source === node.id);
      if (outgoing.length === 0) {
        errors.push('API node "' + node.id + '" must have at least one outgoing edge');
      }
    }

    if (node.type === 'template') {
      if (!node.data.template_id || typeof node.data.template_id !== 'string') {
        errors.push('Template node "' + node.id + '" must have a template_id');
      }
    }
  }

  if (startNodes.length === 1) {
    const startId = startNodes[0].id;
    const outgoingFromStart = edges.filter((e: { source: string }) => e.source === startId);
    if (outgoingFromStart.length === 0 && nodes.length > 1) {
      errors.push('Start node must have at least one outgoing edge');
    }
  }

  if (nodes.length > 0 && edges.length > 0) {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of edges) {
      const targets = adjacency.get(edge.source);
      if (targets) {
        targets.push(edge.target);
      }
    }

    if (startNodes.length === 1) {
      const visited = new Set<string>();
      const queue = [startNodes[0].id];
      visited.add(startNodes[0].id);
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of (adjacency.get(current) || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const unreachable = nodes.filter((n: { id: string }) => !visited.has(n.id));
      if (unreachable.length > 0) {
        errors.push('Unreachable nodes: ' + unreachable.map((n: { id: string; type: string }) => n.id + ' (' + n.type + ')').join(', '));
      }

      const reachableEndNodes = nodes.filter((n: { type: string; id: string }) => n.type === 'end' && visited.has(n.id));
      if (reachableEndNodes.length === 0) {
        errors.push('Flow must have at least one End node reachable from Start');
      }
    }
  }

  for (const node of nodes) {
    const schema = NODE_DATA_SCHEMAS[node.type as FlowNodeType];
    if (schema) {
      const result = schema.safeParse(node.data);
      if (!result.success) {
        const nodeErrors = result.error.issues.map(
          (e) => 'Node "' + node.id + '" (' + node.type + '): ' + e.path.join('.') + ' ' + e.message
        );
        errors.push(...nodeErrors);
      }
    }
  }

  return errors;
}
