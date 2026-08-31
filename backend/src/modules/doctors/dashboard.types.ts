export interface DoctorStats {
  total_patients: number;
  booked: number;
  finished: number;
  no_show: number;
}

export interface TodayPatient {
  id: string;
  patient_id: string;
  patient_name: string;
  phone: string | null;
  gender: string | null;
  age: number | null;
  token_number: number;
  scheduled_start: string;
  custom_status_id: string;
  status_name: string;
  status_color: string | null;
  appointment_type: string;
  venue_name: string | null;
  reason: string;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface VenueTypeStat {
  venue_id: string;
  venue_name: string;
  types: TypeCount[];
  total: number;
}
