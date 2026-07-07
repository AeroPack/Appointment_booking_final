export interface BotSlotsQuery {
  doctor_id: string;
  from: string;
  to?: string;
}

export interface BotBookBody {
  doctor_id: string;
  patient_name: string;
  patient_phone: string;
  slot_start: string;
  reason?: string;
}

export interface BotFaqQuery {
  doctor_id: string;
  query: string;
}

export interface BotLookupQuery {
  phone: string;
  doctor_id: string;
}

export interface BotDoctorInfo {
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

export interface BotFaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface BotChatbotConfig {
  is_enabled: boolean;
  primary_color: string;
  greeting_msg: string;
  position: string;
}

export interface BotPatientLookup {
  patient_id: string;
  name: string;
  mobile_number: string | null;
  past_appointments: number;
}
