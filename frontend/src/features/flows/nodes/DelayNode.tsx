import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Timer } from 'lucide-react';
import type { DelayNodeData } from '../flowTypes';

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as unknown as DelayNodeData;
  const mins = d.offset_minutes || 0;
  const label = mins >= 1440
    ? `${Math.round(mins / 1440)}d before`
    : mins >= 60
      ? `${Math.round(mins / 60)}h before`
      : `${mins}m before`;

  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[150px] max-w-[220px] shadow-sm bg-orange-50 ${selected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-orange-500 flex items-center justify-center">
          <Timer className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Delay</span>
      </div>
      <p className="text-xs text-gray-600">{label}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}
