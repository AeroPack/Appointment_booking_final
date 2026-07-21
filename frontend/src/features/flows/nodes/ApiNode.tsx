import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import type { ApiNodeData } from '../flowTypes';

export function ApiNode({ data, selected }: NodeProps) {
  const d = data as unknown as ApiNodeData;
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[150px] max-w-[220px] shadow-sm bg-purple-50 ${selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-purple-500 flex items-center justify-center">
          <Globe className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">API Fetch</span>
      </div>
      {d.url && <p className="text-xs text-gray-600 truncate">{d.method} {d.url}</p>}
      <div className="flex justify-between mt-1 relative">
        <Handle type="source" position={Position.Bottom} id="success" className="!bg-green-500 !w-2 !h-2 !border !border-white" style={{ left: '30%' }} />
        <Handle type="source" position={Position.Bottom} id="error" className="!bg-red-500 !w-2 !h-2 !border !border-white" style={{ left: '70%' }} />
      </div>
    </div>
  );
}
