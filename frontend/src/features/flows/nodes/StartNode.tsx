import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export function StartNode({ selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[120px] shadow-sm bg-green-50 ${selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-200'}`}>
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-green-500 flex items-center justify-center">
          <Play className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Start</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}
