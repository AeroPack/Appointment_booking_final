import { z } from 'zod';

export const NODE_DATA_SCHEMAS = {
  start: z.object({}).strict(),

  message: z.object({
    text: z.string().min(1).max(1000),
  }).strict(),

  input: z.object({
    text: z.string().min(1).max(500),
    variable: z.string().min(1).max(100),
  }).strict(),

  // min(1): a single-option choice is a valid call to action ("Book
  // Appointment"), and renders as one tappable button on WhatsApp.
  choice: z.object({
    text: z.string().min(1).max(500),
    options: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(100),
      value: z.string().min(1).max(100),
    })).min(1).max(10),
  }).strict(),

  // Offers real appointment slots, read live from the doctor's schedule.
  // Distinct from `choice`, whose options are fixed when the flow is authored.
  slot_picker: z.object({
    text: z.string().min(1).max(500),
    days_ahead: z.number().int().min(1).max(14).default(7),
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

  delay: z.object({
    offset_minutes: z.number().int().min(1).max(43200),
    offset_from: z.enum(['appointment_start', 'appointment_end']).default('appointment_start'),
  }).strict(),

  template: z.object({
    template_id: z.string().min(1),
  }).strict(),

  booking_action: z.object({}).strict(),

  end: z.object({
    message: z.string().max(500).optional(),
  }).strict(),
} as const;

export type FlowNodeType = keyof typeof NODE_DATA_SCHEMAS;
export const FLOW_NODE_TYPES = Object.keys(NODE_DATA_SCHEMAS) as FlowNodeType[];

// Node types that can be used in automation flows (triggered by events)
export const AUTOMATION_NODE_TYPES: FlowNodeType[] = ['start', 'message', 'template', 'choice', 'delay', 'condition', 'api', 'booking_action', 'end'];

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
