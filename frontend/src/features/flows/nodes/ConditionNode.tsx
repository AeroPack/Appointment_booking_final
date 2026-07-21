import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { ConditionNodeData } from '../flowTypes';

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as unknown as ConditionNodeData;
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[150px] max-w-[220px] shadow-sm bg-pink-50 ${selected ? 'border-pink-500 ring-2 ring-pink-200' : 'border-pink-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-pink-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-pink-500 flex items-center justify-center">
          <GitBranch className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Condition</span>
      </div>
      {d.variable && <p className="text-xs text-gray-600 truncate">{d.variable} {d.operator}</p>}
      <div className="flex justify-between mt-1 relative">
        <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 !w-2 !h-2 !border !border-white" style={{ left: '30%' }} />
        <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !w-2 !h-2 !border !border-white" style={{ left: '70%' }} />
      </div>
    </div>
  );
}
