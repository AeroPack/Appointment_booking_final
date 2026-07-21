export type FlowNodeType = 'start' | 'message' | 'choice' | 'api' | 'condition' | 'booking_action' | 'end';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowVersion {
  id: string;
  flow_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'archived';
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

export interface FlowSummary {
  id: string;
  name: string;
  trigger_type: string;
  is_active: boolean;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowDetail {
  flow: FlowSummary;
  versions: FlowVersionSummary[];
}

export interface StartNodeData {}

export interface MessageNodeData {
  text: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  value: string;
}

export interface ChoiceNodeData {
  text: string;
  options: ChoiceOption[];
}

export interface ApiNodeData {
  url: string;
  method: 'GET' | 'POST';
}

export interface ConditionNodeData {
  variable: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'exists';
  value?: string;
}

export interface BookingActionNodeData {}

export interface EndNodeData {
  message?: string;
}

export type FlowNodeDataMap = {
  start: StartNodeData;
  message: MessageNodeData;
  choice: ChoiceNodeData;
  api: ApiNodeData;
  condition: ConditionNodeData;
  booking_action: BookingActionNodeData;
  end: EndNodeData;
};

export type TypedFlowNode<T extends FlowNodeType = FlowNodeType> =
  Omit<FlowNode, 'data'> & { type: T; data: FlowNodeDataMap[T] };
