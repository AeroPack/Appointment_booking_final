export interface StatusPillProps {
  statusName: string;
  statusColor: string | null;
}

export function StatusPill({ statusName, statusColor }: StatusPillProps) {
  const bgColor = (statusColor || '#888') + '20'
  const textColor = statusColor || '#888'
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {statusName}
    </span>
  )
}
