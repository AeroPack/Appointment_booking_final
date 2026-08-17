import pool from '../../config/db.js';
import { FlowSessionRepository } from './flow.session-repository.js';
import { FlowExecutor } from './flow.executor.js';
import type { FlowGraph } from './flow.node-schemas.js';

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

export class FlowScheduler {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly sessionRepo = new FlowSessionRepository();

  start() {
    console.log('[FlowScheduler] Starting scheduler (poll every %dms)', POLL_INTERVAL_MS);
    this.interval = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[FlowScheduler] Stopped');
    }
  }

  private async tick() {
    try {
      const result = await pool.query(
        `SELECT id, session_id, flow_id, flow_version_id, doctor_id, patient_id,
                appointment_id, current_node_id, context, execute_at
         FROM flow_scheduled_executions
         WHERE status = 'pending' AND execute_at <= NOW()
         ORDER BY execute_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      );

      for (const row of result.rows) {
        try {
          await this.processExecution(row);
          await pool.query(
            `UPDATE flow_scheduled_executions SET status = 'executed' WHERE id = $1`,
            [row.id],
          );
        } catch (err) {
          console.error('[FlowScheduler] Error processing execution %s:', row.id, err);
          await pool.query(
            `UPDATE flow_scheduled_executions SET status = 'cancelled' WHERE id = $1`,
            [row.id],
          );
        }
      }
    } catch (err) {
      console.error('[FlowScheduler] Tick error:', err);
    }
  }

  private async processExecution(row: {
    id: string;
    session_id: string;
    flow_id: string;
    flow_version_id: string;
    doctor_id: string;
    patient_id: string | null;
    appointment_id: string | null;
    current_node_id: string;
    context: Record<string, unknown>;
    execute_at: Date;
  }) {
    const session = await this.sessionRepo.findSessionById(row.session_id);
    if (!session) return;
    if (session.status === 'completed' || session.status === 'error' || session.status === 'expired') return;

    const graph = await this.sessionRepo.getFlowGraph(row.flow_version_id);
    if (!graph) return;

    const updatedSession = {
      ...session,
      current_node_id: row.current_node_id,
      context: row.context,
      status: 'running' as const,
    };

    await this.sessionRepo.updateSessionStatus(session.id, 'running', {
      currentNodeId: row.current_node_id,
      context: row.context,
    });

    const executor = new FlowExecutor(this.sessionRepo);
    await executor.executeTurn(updatedSession, graph as FlowGraph);
  }

  async cancelForAppointment(appointmentId: string): Promise<number> {
    const result = await pool.query(
      `UPDATE flow_scheduled_executions
       SET status = 'cancelled'
       WHERE appointment_id = $1 AND status = 'pending'`,
      [appointmentId],
    );
    return result.rowCount ?? 0;
  }
}

export const flowScheduler = new FlowScheduler();
