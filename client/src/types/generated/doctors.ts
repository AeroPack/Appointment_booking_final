// Auto-generated from backend `doctors.types.ts`
// Do not edit — run `npm run inventory` in backend to regenerate.

export interface DoctorProfileRow {
  user_id: string;
  name: string;
  speciality: string | null;
  qualification: string | null;
  registration_number: string | null;
  bio: string | null;
  consultation_fee: string | null;
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
