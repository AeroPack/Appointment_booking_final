// Auto-generated from backend `auth.types.ts`
// Do not edit — run `npm run inventory` in backend to regenerate.

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
  role: 'doctor' | 'patient' | 'staff';
  is_verified: boolean;
}

export interface OtpRow {
  id: string;
  mobile_number: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used: boolean;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}
