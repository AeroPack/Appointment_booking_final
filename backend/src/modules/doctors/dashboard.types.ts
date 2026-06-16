export interface DoctorStats {
  total_patients: number;
  booked: number;
  finished: number;
  no_show: number;
}

export interface TodayPatient {
  id: string;
  patient_name: string;
  token_number: number;
  scheduled_start: string;
  appointment_status: string;
  venue_name: string | null;
}
