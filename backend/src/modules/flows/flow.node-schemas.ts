import { z } from 'zod';

export const NODE_DATA_SCHEMAS = {
  start: z.object({}).strict(),

  message: z.object({
    text: z.string().min(1).max(1000),
  }).strict(),

  choice: z.object({
    text: z.string().min(1).max(500),
    options: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(100),
      value: z.string().min(1).max(100),
    })).min(2).max(10),
  }).strict(),

  api: z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST']).default('GET'),
  }).strict(),

  condition: z.object({
    variable: z.string().min(1).max(100),
    operator: z.enum(['equals', 'not_equals', 'contains', 'exists']),
    value: z.string().max(200).optional(),
  }).strict(),

  booking_action: z.object({}).strict(),

  end: z.object({
    message: z.string().max(500).optional(),
  }).strict(),
} as const;

export type FlowNodeType = keyof typeof NODE_DATA_SCHEMAS;
export const FLOW_NODE_TYPES = Object.keys(NODE_DATA_SCHEMAS) as FlowNodeType[];

const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FLOW_NODE_TYPES as [string, ...string[]]),
  position: nodePositionSchema,
  data: z.record(z.unknown()),
});

const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const flowGraphShapeSchema = z.object({
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
});

export type FlowGraph = z.infer<typeof flowGraphShapeSchema>;
