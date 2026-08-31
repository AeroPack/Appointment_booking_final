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
  venue_id?: string;
}

export interface BookSlotBody {
  doctor_id: string;
  scheduled_start: string;
  patient_id?: string;
  idempotency_key: string;
  appointment_type?: string;
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
  appointment_type: string;
  venue: { id: string; name: string } | null;
}

export interface AppointmentRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_start: string;
  scheduled_end: string;
  token_number: number | null;
  custom_status_id: string;
  status_name: string;
  status_color: string | null;
  appointment_type: string;
  venue_id: string | null;
  venue_name: string | null;
  doctor_name: string;
  patient_name: string;
  doctor_mobile: string | null;
  notes: string | null;
  clinical_notes: string | null;
}

export interface AppointmentHistoryRow {
  id: string;
  doctor_name: string;
  scheduled_start: string;
  scheduled_end: string;
  custom_status_id: string;
  status_name: string;
  status_color: string | null;
  appointment_type: string;
  token_number: number | null;
  clinical_notes: string | null;
  venue_name: string | null;
}
