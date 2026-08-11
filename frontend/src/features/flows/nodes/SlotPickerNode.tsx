import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CalendarClock } from 'lucide-react';
import type { SlotPickerNodeData } from '../flowTypes';

export function SlotPickerNode({ data, selected }: NodeProps) {
  const d = data as unknown as SlotPickerNodeData;

  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[180px] max-w-[250px] shadow-sm bg-sky-50 ${selected ? 'border-sky-500 ring-2 ring-sky-200' : 'border-sky-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="h-6 w-6 rounded bg-sky-500 flex items-center justify-center">
          <CalendarClock className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Slot Picker</span>
      </div>
      {d.text && <p className="text-xs text-gray-600 truncate mb-1">{d.text}</p>}
      <p className="text-xs text-gray-500">
        Next {d.days_ahead ?? 7} days of free slots
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}
