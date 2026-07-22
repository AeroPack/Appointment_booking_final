export interface Slot {
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
  slots: Slot[];
}

export interface SlotsResponse {
  doctor_setting: { slot_duration_minutes: number; max_patients_per_slot: number };
  days: DaySlots[];
}

export interface BookResponse {
  appointment_id: string;
  token_number: number;
  doctor_name: string;
  scheduled_start: string;
  scheduled_end: string;
  venue: { id: string; name: string } | null;
  patient_name: string;
}

export interface DoctorInfo {
  user_id: string;
  name: string;
  avatar_url: string | null;
  speciality: string | null;
  qualification: string | null;
  bio: string | null;
  consultation_fee: string | null;
  title: string | null;
  experience_years: number | null;
  venue_name: string | null;
  venue_address: string | null;
}

export interface FaqResponse {
  answer: string | null;
  matched: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  buttons?: ButtonOption[];
  timestamp: Date;
}

export interface ButtonOption {
  label: string;
  value: string;
}

export type FlowStep =
  | 'greeting'
  | 'collect_name'
  | 'collect_phone'
  | 'show_dates'
  | 'show_times'
  | 'collect_reason'
  | 'confirming'
  | 'done';

export interface WidgetConfig {
  widgetKey: string;
  apiHost: string;
  primaryColor: string;
  greeting: string;
  position: 'bottom-right' | 'bottom-left';
}
