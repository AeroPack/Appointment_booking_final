const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-blue-100 text-blue-800',
  finished: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
}

export interface StatusPillProps {
  status: string;
}

export function StatusPill({ status }: StatusPillProps) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
      {status}
    </span>
  )
}
