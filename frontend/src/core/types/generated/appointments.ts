// Auto-generated from backend `appointments.types.ts`
// Do not edit — run `npm run inventory` in backend to regenerate.

export interface SlotResponse {
  start: string;
  end: string;
  capacity: number;
  booked_count: number;
  available: number;
  is_full: boolean;
  venue: { id: string; name: string } | null;
}

export interface DaySlots {
  date: string;
  slots: SlotResponse[];
}

export interface FindSlotsQuery {
  doctor_id: string;
  from: string;
  to?: string;
}

export interface BookSlotBody {
  doctor_id: string;
  scheduled_start: string;
  patient_id?: string;
  idempotency_key: string;
}

export interface BookingResponse {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  token_number: number | null;
  custom_status_id: string;
  status_name: string;
  status_color: string | null;
  venue: { id: string; name: string } | null;
}
