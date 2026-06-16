// Auto-generated from backend `settings.types.ts`
// Do not edit — run `npm run inventory` in backend to regenerate.

export interface AppointmentSettingRow {
  id: string;
  doctor_id: string;
  venue_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_patients_per_slot: number;
  is_active: boolean;
}

export interface PeriodInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue_id?: string;
  slot_duration_minutes: number;
  max_patients_per_slot: number;
}

export interface ReminderInput {
  template_type: string;
  offset_minutes?: number;
  subject?: string;
  content: string;
  channel?: string;
}

export interface PutSettingsInput {
  doctor_id: string;
  periods: PeriodInput[];
  reminders: ReminderInput[];
}

export interface MessageTemplateRow {
  id: string;
  clinic_id: string;
  doctor_id: string | null;
  template_type: string;
  subject: string | null;
  content: string;
  offset_minutes: number | null;
  channel: string;
  is_active: boolean;
}

export interface CreateTemplateInput {
  doctor_id?: string;
  template_type: string;
  subject?: string;
  content: string;
  offset_minutes?: number;
  channel?: string;
}

export interface UpdateTemplateInput {
  template_type?: string;
  subject?: string;
  content?: string;
  offset_minutes?: number | null;
  channel?: string;
  is_active?: boolean;
}
