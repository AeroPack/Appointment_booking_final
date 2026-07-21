import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ListChecks } from 'lucide-react';
import type { ChoiceNodeData } from '../flowTypes';

export function ChoiceNode({ data, selected }: NodeProps) {
  const d = data as unknown as ChoiceNodeData;
  const options = d.options || [];

  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[180px] max-w-[250px] shadow-sm bg-amber-50 ${selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-amber-500 flex items-center justify-center">
          <ListChecks className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Choice</span>
      </div>
      {d.text && <p className="text-xs text-gray-600 truncate mb-1">{d.text}</p>}
      <div className="space-y-0.5">
        {options.map((opt, i) => (
          <div key={opt.id} className="relative">
            <div className="text-xs text-gray-500 pl-2 border-l-2 border-amber-300">
              {opt.label}
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id={`option:${opt.id}`}
              className="!bg-amber-500 !w-2 !h-2 !border !border-white"
              style={{ top: `${30 + i * 20}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
