import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CalendarCheck } from 'lucide-react';

export function BookingActionNode({ selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[150px] shadow-sm bg-teal-50 ${selected ? 'border-teal-500 ring-2 ring-teal-200' : 'border-teal-200'}`}>
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-teal-500 flex items-center justify-center">
          <CalendarCheck className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium">Book Appointment</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}
