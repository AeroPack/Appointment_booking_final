export interface AuthPayload {
  userId: string;
  role: 'doctor' | 'patient' | 'staff';
  clinicId: string;
}

export interface UserRow {
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
  password_hash: string | null;
}

export interface OtpRow {
  id: string;
  mobile_number: string | null;
  email: string | null;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used: boolean;
}

export type AuthIdentifier = { mobile_number: string } | { email: string };

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface RegisterInput {
  name: string;
  email?: string;
  mobile_number?: string;
  password: string;
}

export interface LoginPasswordInput {
  email_or_mobile: string;
  password: string;
}

export interface UpdateProfileInput {
  title?: string;
  speciality?: string;
  qualification?: string;
  registration_number?: string;
  consultation_fee?: number;
  experience_years?: number;
  bio?: string;
}

export interface SetupWhatsAppInput {
  whatsapp_enabled?: boolean;
  ultramsg_instance_id?: string;
  ultramsg_token?: string;
  whatsapp_number?: string;
}

export interface ForgotPasswordInput {
  email?: string;
  mobile_number?: string;
}

export interface VerifyPasswordResetInput {
  user_id: string;
  otp: string;
}

export interface ResetPasswordInput {
  user_id: string;
  otp: string;
  new_password: string;
}

export interface PasswordResetOtpRow {
  id: string;
  user_id: string;
  mobile_number: string | null;
  email: string | null;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used: boolean;
}
