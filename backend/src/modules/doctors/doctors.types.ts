export interface DoctorProfileRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  speciality: string | null;
  qualification: string | null;
  registration_number: string | null;
  bio: string | null;
  consultation_fee: string | null;
  title: string | null;
  experience_years: number | null;
  patient_count: number | null;
  awards_count: number | null;
  publications_count: number | null;
}

export interface VenueWithAddress {
  id: string;
  name: string;
  address: string | null;
}

export interface VenueRow {
  id: string;
  clinic_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface CreateVenueInput {
  name: string;
  address?: string;
  phone?: string;
}

export interface UpdateVenueInput {
  name?: string;
  address?: string;
  phone?: string;
  is_active?: boolean;
}

export interface DoctorOwnProfileRow {
  id: string;
  name: string;
  email: string | null;
  mobile_number: string | null;
  address: string | null;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  title: string | null;
  speciality: string | null;
  qualification: string | null;
  registration_number: string | null;
  bio: string | null;
  consultation_fee: string | null;
  experience_years: number | null;
}

export interface UpdateDoctorProfileInput {
  title?: string;
  speciality?: string;
  qualification?: string;
  registration_number?: string;
  bio?: string;
  consultation_fee?: number;
  experience_years?: number;
}
