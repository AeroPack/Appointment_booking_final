import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import type { MessageNodeData } from '../flowTypes';

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as unknown as MessageNodeData;
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[150px] max-w-[220px] shadow-sm bg-blue-50 ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-blue-500 flex items-center justify-center">
          <MessageSquare className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Message</span>
      </div>
      {d.text && <p className="text-xs text-gray-600 truncate">{d.text}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}
