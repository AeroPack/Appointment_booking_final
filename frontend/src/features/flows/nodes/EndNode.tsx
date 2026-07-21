import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CircleOff } from 'lucide-react';
import type { EndNodeData } from '../flowTypes';

export function EndNode({ data, selected }: NodeProps) {
  const d = data as unknown as EndNodeData;
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[120px] shadow-sm bg-red-50 ${selected ? 'border-red-500 ring-2 ring-red-200' : 'border-red-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-red-500 flex items-center justify-center">
          <CircleOff className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">End</span>
      </div>
      {d.message && <p className="text-xs text-gray-600 truncate mt-1">{d.message}</p>}
    </div>
  );
}
