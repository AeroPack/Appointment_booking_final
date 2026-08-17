import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import type { TemplateNodeData } from '../flowTypes';

export function TemplateNode({ data, selected }: NodeProps) {
  const d = data as unknown as TemplateNodeData;
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[150px] max-w-[220px] shadow-sm bg-emerald-50 ${selected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-emerald-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-emerald-500 flex items-center justify-center">
          <FileText className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Template</span>
      </div>
      {d.template_id ? (
        <p className="text-xs text-gray-600 truncate">Template message</p>
      ) : (
        <p className="text-xs text-gray-400 italic">Click to select template</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}
