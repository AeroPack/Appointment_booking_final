import pool from '../../config/db.js';
import type { FlowGraph } from './flow.node-schemas.js';

export interface FlowSessionRow {
  id: string;
  flow_id: string;
  flow_version_id: string;
  doctor_id: string;
  patient_id: string | null;
  channel: 'whatsapp' | 'web';
  channel_session_id: string | null;
  current_node_id: string | null;
  context: Record<string, unknown>;
  status: 'idle' | 'running' | 'waiting_input' | 'completed' | 'error' | 'expired';
  error_message: string | null;
  step_count: number;
  started_at: Date | null;
  last_activity_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface FlowMessageRow {
  id: string;
  session_id: string;
  direction: 'outbound' | 'inbound';
  node_id: string | null;
  content: string;
  message_type: 'text' | 'choice' | 'api_request' | 'api_response' | 'system';
  channel_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export class FlowSessionRepository {
  async createSession(params: {
    flowId: string;
    flowVersionId: string;
    doctorId: string;
    patientId: string | null;
    channel: 'whatsapp' | 'web';
    channelSessionId: string;
  }): Promise<FlowSessionRow> {
    const result = await pool.query(
      `INSERT INTO flow_sessions (flow_id, flow_version_id, doctor_id, patient_id, channel, channel_session_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'idle')
       RETURNING *`,
      [params.flowId, params.flowVersionId, params.doctorId, params.patientId, params.channel, params.channelSessionId]
    );
    return result.rows[0];
  }

  async findActiveSession(doctorId: string, channelSessionId: string): Promise<FlowSessionRow | null> {
    const result = await pool.query(
      `SELECT * FROM flow_sessions
       WHERE doctor_id = $1 AND channel_session_id = $2
         AND status IN ('idle', 'running', 'waiting_input')
       ORDER BY created_at DESC
       LIMIT 1`,
      [doctorId, channelSessionId]
    );
    return result.rows[0] || null;
  }

  async findSessionById(sessionId: string): Promise<FlowSessionRow | null> {
    const result = await pool.query(
      `SELECT * FROM flow_sessions WHERE id = $1`,
      [sessionId]
    );
    return result.rows[0] || null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: FlowSessionRow['status'],
    extra?: { currentNodeId?: string; errorMessage?: string; context?: Record<string, unknown> }
  ): Promise<void> {
    const sets: string[] = ['status = $2', 'last_activity_at = NOW()'];
    const params: unknown[] = [sessionId, status];
    let paramIdx = 3;

    if (extra?.currentNodeId !== undefined) {
      sets.push(`current_node_id = $${paramIdx}`);
      params.push(extra.currentNodeId);
      paramIdx++;
    }
    if (extra?.errorMessage !== undefined) {
      sets.push(`error_message = $${paramIdx}`);
      params.push(extra.errorMessage);
      paramIdx++;
    }
    if (extra?.context !== undefined) {
      sets.push(`context = $${paramIdx}`);
      params.push(JSON.stringify(extra.context));
      paramIdx++;
    }
    if (status === 'running') {
      sets.push(`started_at = COALESCE(started_at, NOW())`);
    }
    if (status === 'completed' || status === 'error') {
      sets.push(`completed_at = NOW()`);
    }

    await pool.query(
      `UPDATE flow_sessions SET ${sets.join(', ')} WHERE id = $1`,
      params
    );
  }

  async incrementStepCount(sessionId: string): Promise<number> {
    const result = await pool.query(
      `UPDATE flow_sessions SET step_count = step_count + 1, last_activity_at = NOW()
       WHERE id = $1
       RETURNING step_count`,
      [sessionId]
    );
    return result.rows[0]?.step_count ?? 0;
  }

  async getFlowGraph(versionId: string): Promise<FlowGraph | null> {
    const result = await pool.query(
      `SELECT graph FROM flow_versions WHERE id = $1`,
      [versionId]
    );
    return result.rows[0]?.graph || null;
  }

  async findPublishedFlowForDoctor(doctorId: string, triggerType: string): Promise<{
    flowId: string;
    flowName: string;
    versionId: string;
    graph: FlowGraph;
  } | null> {
    const result = await pool.query(
      `SELECT f.id AS "flowId", f.name AS "flowName", fv.id AS "versionId", fv.graph
       FROM flows f
       JOIN flow_versions fv ON fv.id = f.published_version_id
       WHERE (f.doctor_id = $1 OR f.doctor_id IS NULL) AND f.trigger_type = $2 AND f.is_active = true
       ORDER BY f.doctor_id NULLS LAST
       LIMIT 1`,
      [doctorId, triggerType]
    );
    return result.rows[0] || null;
  }

  async findDoctorClinicId(doctorId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT clinic_id FROM users WHERE id = $1 AND role = 'doctor' AND deleted_at IS NULL`,
      [doctorId]
    );
    return result.rows[0]?.clinic_id || null;
  }

  async addMessage(params: {
    sessionId: string;
    direction: 'outbound' | 'inbound';
    nodeId: string | null;
    content: string;
    messageType: FlowMessageRow['message_type'];
    channelMessageId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<FlowMessageRow> {
    const result = await pool.query(
      `INSERT INTO flow_messages (session_id, direction, node_id, content, message_type, channel_message_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.sessionId,
        params.direction,
        params.nodeId,
        params.content,
        params.messageType,
        params.channelMessageId || null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );
    return result.rows[0];
  }

  async getMessages(sessionId: string, limit = 100): Promise<FlowMessageRow[]> {
    const result = await pool.query(
      `SELECT * FROM flow_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [sessionId, limit]
    );
    return result.rows;
  }

  async expireStaleSessions(olderThanHours = 24): Promise<number> {
    const result = await pool.query(
      `UPDATE flow_sessions
       SET status = 'expired', updated_at = NOW(), completed_at = NOW()
       WHERE status IN ('idle', 'running', 'waiting_input')
         AND last_activity_at < NOW() - INTERVAL '1 hour' * $1
       RETURNING id`,
      [olderThanHours]
    );
    return result.rowCount ?? 0;
  }
}
