export interface SlotTime {
  start: string;
  end: string;
}

export function generateSlotsForPeriod(
  startTime: string,
  endTime: string,
  slotDurationMinutes: number
): SlotTime[] {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  const slots: SlotTime[] = [];

  let current = startMinutes;
  while (current + slotDurationMinutes <= endMinutes) {
    const slotStart = formatTime(current);
    const slotEnd = formatTime(current + slotDurationMinutes);
    slots.push({ start: slotStart, end: slotEnd });
    current += slotDurationMinutes;
  }

  return slots;
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const TIMEZONE_OFFSET = '+05:30';

export function combineDateAndTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00${TIMEZONE_OFFSET}`;
}
