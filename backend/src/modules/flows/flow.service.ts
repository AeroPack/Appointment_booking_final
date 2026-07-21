import { AppError } from '../../utils/response.js';
import { FlowRepository } from './flow.repository.js';
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
    choice: null,
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
