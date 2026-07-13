export interface RequestOtpRequest {
  mobile_number?: string
  email?: string
}

export interface RequestOtpResponse {
  message: string
  expires_in: number
}

export interface VerifyOtpRequest {
  mobile_number?: string
  email?: string
  otp: string
}

export interface AuthUser {
  id: string
  name: string
  role: 'doctor' | 'patient' | 'staff'
  mobile_number: string | null
  email: string | null
}

export interface VerifyOtpResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  identifier: string | null
}

// ─── Registration Types ─────────────────────────────────────────────────────────

export interface RegisterRequest {
  name: string
  email?: string
  mobile_number?: string
  password: string
}

export interface RegisterResponse {
  user_id: string
  expires_in: number
}

export interface VerifyRegistrationOtpRequest {
  user_id: string
  otp: string
}

export interface LoginPasswordRequest {
  email_or_mobile: string
  password: string
}

export interface LoginPasswordResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface UpdateProfileRequest {
  title?: 'Dr.' | 'Prof.' | 'Mr.' | 'Ms.'
  speciality?: string
  qualification?: string
  registration_number?: string
  consultation_fee?: number
  experience_years?: number
  bio?: string
}

export interface SetupWhatsAppRequest {
  whatsapp_enabled?: boolean
  ultramsg_instance_id?: string
  ultramsg_token?: string
  whatsapp_number?: string
}

// ─── Forgot Password / Password Reset Types ──────────────────────────────────────

export interface ForgotPasswordRequest {
  email?: string
  mobile_number?: string
}

export interface ForgotPasswordResponse {
  message: string
  user_id: string
  expires_in: number
}

export interface VerifyPasswordResetOtpRequest {
  user_id: string
  otp: string
}

export interface VerifyPasswordResetOtpResponse {
  valid: boolean
  message: string
}

export interface ResetPasswordRequest {
  user_id: string
  otp: string
  new_password: string
}

export interface ResetPasswordResponse {
  message: string
}
