import type { Connection, Node, Edge } from '@xyflow/react';
import type { FlowNodeType, FlowNode, ChoiceOption } from './flowTypes';
import { NODE_TYPE_DEFINITIONS, NODE_COMPONENTS } from './nodeTypes';

const ALLOWED_SOURCE_HANDLES: Record<string, string[] | null> = {
  start: null,
  message: null,
  choice: null,
  api: ['success', 'error'],
  condition: ['true', 'false'],
  booking_action: null,
  end: null,
};

const NO_INCOMING: FlowNodeType[] = ['start'];
const NO_OUTGOING: FlowNodeType[] = ['end'];

export function validateConnectionRules(
  connection: Connection,
  nodes: Node[],
  edges: Edge[]
): string | null {
  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) return 'Invalid node';

  if (connection.source === connection.target) return 'Cannot connect node to itself';

  if (NO_INCOMING.includes(targetNode.type as FlowNodeType)) {
    return 'Start node cannot have incoming edges';
  }

  if (NO_OUTGOING.includes(sourceNode.type as FlowNodeType)) {
    return 'End node cannot have outgoing edges';
  }

  if (connection.sourceHandle) {
    const allowed = ALLOWED_SOURCE_HANDLES[sourceNode.type as string];
    if (allowed !== null && allowed !== undefined && !allowed.includes(connection.sourceHandle)) {
      return `Invalid handle for ${sourceNode.type} node`;
    }
  }

  if (sourceNode.type === 'condition') {
    const outgoing = edges.filter(e => e.source === sourceNode.id);
    if (outgoing.length >= 2) return 'Condition node can have at most 2 outgoing edges';
  }

  if (sourceNode.type === 'api') {
    const outgoing = edges.filter(e => e.source === sourceNode.id);
    if (outgoing.length >= 2) return 'API node can have at most 2 outgoing edges';
  }

  const duplicate = edges.find(
    e => e.source === connection.source
      && e.target === connection.target
      && e.sourceHandle === connection.sourceHandle
      && e.targetHandle === connection.targetHandle
  );
  if (duplicate) return 'This connection already exists';

  return null;
}

export function createNodeFromPalette(
  type: FlowNodeType,
  position: { x: number; y: number }
): FlowNode {
  const def = NODE_TYPE_DEFINITIONS[type];
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    position,
    data: { ...def.defaultData },
  };
}

export function summarizeNode(node: Node): string {
  const type = node.type as FlowNodeType;
  const data = node.data as Record<string, unknown>;

  switch (type) {
    case 'start': return 'Flow start';
    case 'message': return String(data.text || 'Empty message').slice(0, 40);
    case 'choice': {
      const opts = Array.isArray(data.options) ? data.options : [];
      return `${opts.length} options`;
    }
    case 'api': return String(data.url || 'No URL').slice(0, 40);
    case 'condition': return `${data.variable} ${data.operator}`;
    case 'booking_action': return 'Book appointment';
    case 'end': return String(data.message || 'Flow end').slice(0, 40);
    default: return type;
  }
}

export function buildNodeTypes() {
  const nodeTypes: Record<string, React.ComponentType<any>> = {};
  for (const [type, Component] of Object.entries(NODE_COMPONENTS)) {
    nodeTypes[type] = Component;
  }
  return nodeTypes;
}

export function removeStaleChoiceEdges(
  nodeId: string,
  options: ChoiceOption[],
  edges: Edge[]
): Edge[] {
  const validHandles = new Set(options.map(o => `option:${o.id}`));
  return edges.filter(edge => {
    if (edge.source !== nodeId) return true;
    if (!edge.sourceHandle) return true;
    return validHandles.has(edge.sourceHandle);
  });
}
