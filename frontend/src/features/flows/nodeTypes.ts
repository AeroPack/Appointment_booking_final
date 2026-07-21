import type { LucideIcon } from 'lucide-react';
import { Play, MessageSquare, ListChecks, Globe, GitBranch, CalendarCheck, CircleOff } from 'lucide-react';
import type { FlowNodeType } from './flowTypes';
import { StartNode, MessageNode, ChoiceNode, ApiNode, ConditionNode, BookingActionNode, EndNode } from './nodes';

export interface NodeTypeDefinition {
  type: FlowNodeType;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  defaultData: Record<string, unknown>;
}

export const NODE_TYPE_DEFINITIONS: Record<FlowNodeType, NodeTypeDefinition> = {
  start: {
    type: 'start',
    label: 'Start',
    icon: Play,
    color: '#22c55e',
    bgColor: '#f0fdf4',
    defaultData: {},
  },
  message: {
    type: 'message',
    label: 'Message',
    icon: MessageSquare,
    color: '#3b82f6',
    bgColor: '#eff6ff',
    defaultData: { text: '' },
  },
  choice: {
    type: 'choice',
    label: 'Choice',
    icon: ListChecks,
    color: '#f59e0b',
    bgColor: '#fffbeb',
    defaultData: {
      text: '',
      options: [
        { id: crypto.randomUUID(), label: 'Option 1', value: 'option_1' },
        { id: crypto.randomUUID(), label: 'Option 2', value: 'option_2' },
      ],
    },
  },
  api: {
    type: 'api',
    label: 'API Fetch',
    icon: Globe,
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    defaultData: { url: '', method: 'GET' },
  },
  condition: {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    color: '#ec4899',
    bgColor: '#fdf2f8',
    defaultData: { variable: '', operator: 'equals', value: '' },
  },
  booking_action: {
    type: 'booking_action',
    label: 'Book Appointment',
    icon: CalendarCheck,
    color: '#14b8a6',
    bgColor: '#f0fdfa',
    defaultData: {},
  },
  end: {
    type: 'end',
    label: 'End',
    icon: CircleOff,
    color: '#ef4444',
    bgColor: '#fef2f2',
    defaultData: {},
  },
};

export const NODE_COMPONENTS: Record<FlowNodeType, React.ComponentType<any>> = {
  start: StartNode,
  message: MessageNode,
  choice: ChoiceNode,
  api: ApiNode,
  condition: ConditionNode,
  booking_action: BookingActionNode,
  end: EndNode,
};

export const NODE_TYPE_LIST = Object.values(NODE_TYPE_DEFINITIONS);
