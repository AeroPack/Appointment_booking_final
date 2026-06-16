export interface UserProfile {
  id: string;
  clinic_id: string;
  parent_user_id: string | null;
  name: string;
  mobile_number: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  avatar_url: string | null;
  relationship: string | null;
  role: 'doctor' | 'patient' | 'staff';
  is_verified: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  address?: string;
  date_of_birth?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface CreateDependentInput {
  name: string;
  mobile_number?: string;
  email?: string;
  address?: string;
  relationship?: string;
  date_of_birth?: string;
}

export interface UpdateDependentInput {
  name?: string;
  mobile_number?: string;
  email?: string;
  address?: string;
  relationship?: string;
  date_of_birth?: string;
}
