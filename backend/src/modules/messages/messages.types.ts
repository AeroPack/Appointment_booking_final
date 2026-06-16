export interface MessageRow {
  id: string;
  appointment_id: string | null;
  template_id: string | null;
  sender_id: string | null;
  receiver_id: string;
  message_name: string | null;
  content: string;
  channel: string;
  schedule_for: Date | null;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  sent_at: Date | null;
}

export interface SendMessageBody {
  template_id: string;
  receiver_id: string;
  appointment_id?: string;
  schedule_for?: string;
}

export interface AppointmentForRender {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_start: Date;
  scheduled_end: Date;
  token_number: number | null;
  venue_id: string | null;
  venue_name: string | null;
  doctor_name: string;
  patient_name: string;
  clinic_name: string;
}
