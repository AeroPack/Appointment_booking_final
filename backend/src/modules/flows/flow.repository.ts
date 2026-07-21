import pool from '../../config/db.js';
import type { FlowGraph } from './flow.node-schemas.js';

export interface FlowSummary {
  id: string;
  name: string;
  trigger_type: string;
  is_active: boolean;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowVersionRow {
  id: string;
  flow_id: string;
  version_number: number;
  status: string;
  graph: FlowGraph;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
}

export interface FlowVersionSummary {
  id: string;
  version_number: number;
  status: string;
  created_at: string;
  published_at: string | null;
}

export interface FlowDetail {
  flow: FlowSummary;
  versions: FlowVersionSummary[];
}

export class FlowRepository {
  async createFlow(doctorId: string, name: string, triggerType: string): Promise<FlowSummary> {
    const result = await pool.query(
      `INSERT INTO flows (doctor_id, name, trigger_type)
       VALUES ($1, $2, $3)
       RETURNING id, name, trigger_type, is_active, published_version_id, created_at, updated_at`,
      [doctorId, name, triggerType]
    );
    const flow = result.rows[0];

    await pool.query(
      `INSERT INTO flow_versions (flow_id, version_number, status, graph, created_by)
       VALUES ($1, 1, 'draft', $2, $3)`,
      [flow.id, JSON.stringify({ nodes: [], edges: [] }), doctorId]
    );

    return flow;
  }

  async listFlowsByDoctor(doctorId: string): Promise<FlowSummary[]> {
    const result = await pool.query(
      `SELECT id, name, trigger_type, is_active, published_version_id, created_at, updated_at
       FROM flows
       WHERE doctor_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [doctorId]
    );
    return result.rows;
  }

  async findFlowForDoctor(flowId: string, doctorId: string): Promise<FlowSummary | null> {
    const result = await pool.query(
      `SELECT id, name, trigger_type, is_active, published_version_id, created_at, updated_at
       FROM flows
       WHERE id = $1 AND doctor_id = $2 AND deleted_at IS NULL`,
      [flowId, doctorId]
    );
    return result.rows[0] || null;
  }

  async listVersions(flowId: string): Promise<FlowVersionSummary[]> {
    const result = await pool.query(
      `SELECT id, version_number, status, created_at, published_at
       FROM flow_versions
       WHERE flow_id = $1
       ORDER BY version_number DESC`,
      [flowId]
    );
    return result.rows;
  }

  async findVersion(versionId: string, flowId: string): Promise<FlowVersionRow | null> {
    const result = await pool.query(
      `SELECT id, flow_id, version_number, status, graph, created_by, created_at, published_at
       FROM flow_versions
       WHERE id = $1 AND flow_id = $2`,
      [versionId, flowId]
    );
    return result.rows[0] || null;
  }

  async findDraftVersion(flowId: string): Promise<FlowVersionRow | null> {
    const result = await pool.query(
      `SELECT id, flow_id, version_number, status, graph, created_by, created_at, published_at
       FROM flow_versions
       WHERE flow_id = $1 AND status = 'draft'
       ORDER BY version_number DESC
       LIMIT 1`,
      [flowId]
    );
    return result.rows[0] || null;
  }

  async findPublishedVersion(flowId: string): Promise<FlowVersionRow | null> {
    const result = await pool.query(
      `SELECT id, flow_id, version_number, status, graph, created_by, created_at, published_at
       FROM flow_versions
       WHERE flow_id = $1 AND status = 'published'
       LIMIT 1`,
      [flowId]
    );
    return result.rows[0] || null;
  }

  async updateDraftGraph(versionId: string, graph: FlowGraph): Promise<boolean> {
    const result = await pool.query(
      `UPDATE flow_versions SET graph = $2 WHERE id = $1 AND status = 'draft'`,
      [versionId, JSON.stringify(graph)]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getNextVersionNumber(flowId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM flow_versions WHERE flow_id = $1`,
      [flowId]
    );
    return Number(result.rows[0].next);
  }

  async createDraftVersion(flowId: string, createdBy: string, graph?: FlowGraph): Promise<FlowVersionRow> {
    const nextVersion = await this.getNextVersionNumber(flowId);
    const graphJson = JSON.stringify(graph || { nodes: [], edges: [] });
    const result = await pool.query(
      `INSERT INTO flow_versions (flow_id, version_number, status, graph, created_by)
       VALUES ($1, $2, 'draft', $3, $4)
       RETURNING id, flow_id, version_number, status, graph, created_by, created_at, published_at`,
      [flowId, nextVersion, graphJson, createdBy]
    );
    return result.rows[0];
  }

  async publishVersion(flowId: string, versionId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE flow_versions SET status = 'archived' WHERE flow_id = $1 AND status = 'published'`,
        [flowId]
      );

      await client.query(
        `UPDATE flow_versions SET status = 'published', published_at = NOW() WHERE id = $1`,
        [versionId]
      );

      await client.query(
        `UPDATE flows SET published_version_id = $1 WHERE id = $2`,
        [versionId, flowId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rollbackToVersion(flowId: string, targetVersionId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE flow_versions SET status = 'archived' WHERE flow_id = $1 AND status = 'published'`,
        [flowId]
      );

      await client.query(
        `UPDATE flow_versions SET status = 'published', published_at = NOW() WHERE id = $1`,
        [targetVersionId]
      );

      await client.query(
        `UPDATE flows SET published_version_id = $1 WHERE id = $2`,
        [targetVersionId, flowId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
