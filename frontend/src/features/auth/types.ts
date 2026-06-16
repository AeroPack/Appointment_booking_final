export interface RequestOtpRequest {
  mobile_number: string
}

export interface RequestOtpResponse {
  message: string
  expires_in: number
}

export interface VerifyOtpRequest {
  mobile_number: string
  otp: string
}

export interface AuthUser {
  id: string
  name: string
  role: 'doctor' | 'patient' | 'staff'
  mobile_number: string | null
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
  mobile: string | null
}
