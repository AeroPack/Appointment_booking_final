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
  appointment_status: string;
  appointment_type: string;
  venue_name: string | null;
  reason: string;
}
