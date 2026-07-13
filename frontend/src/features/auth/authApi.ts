import { api } from '@/core/store/baseApi'
import type {
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyRegistrationOtpRequest,
  LoginPasswordRequest,
  LoginPasswordResponse,
  UpdateProfileRequest,
  SetupWhatsAppRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  VerifyPasswordResetOtpRequest,
  VerifyPasswordResetOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from './types'

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    requestOtp: builder.mutation<RequestOtpResponse, RequestOtpRequest>({
      query: (body) => ({ url: '/api/auth/request-otp', method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<VerifyOtpResponse, VerifyOtpRequest>({
      query: (body) => ({ url: '/api/auth/verify-otp', method: 'POST', body }),
    }),
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({ url: '/api/auth/register', method: 'POST', body }),
    }),
    verifyRegistrationOtp: builder.mutation<VerifyOtpResponse, VerifyRegistrationOtpRequest>({
      query: (body) => ({ url: '/api/auth/verify-registration-otp', method: 'POST', body }),
    }),
    loginPassword: builder.mutation<LoginPasswordResponse, LoginPasswordRequest>({
      query: (body) => ({ url: '/api/auth/login-password', method: 'POST', body }),
    }),
    updateProfile: builder.mutation<{ message: string }, UpdateProfileRequest>({
      query: (body) => ({ url: '/api/auth/update-profile', method: 'POST', body }),
    }),
    setupWhatsApp: builder.mutation<{ message: string }, SetupWhatsAppRequest>({
      query: (body) => ({ url: '/api/auth/setup-whatsapp', method: 'POST', body }),
    }),
    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (body) => ({ url: '/api/auth/forgot-password', method: 'POST', body }),
    }),
    verifyPasswordResetOtp: builder.mutation<VerifyPasswordResetOtpResponse, VerifyPasswordResetOtpRequest>({
      query: (body) => ({ url: '/api/auth/verify-password-reset-otp', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<ResetPasswordResponse, ResetPasswordRequest>({
      query: (body) => ({ url: '/api/auth/reset-password', method: 'POST', body }),
    }),
  }),
})

export const {
  useRequestOtpMutation,
  useVerifyOtpMutation,
  useRegisterMutation,
  useVerifyRegistrationOtpMutation,
  useLoginPasswordMutation,
  useUpdateProfileMutation,
  useSetupWhatsAppMutation,
  useForgotPasswordMutation,
  useVerifyPasswordResetOtpMutation,
  useResetPasswordMutation,
} = authApi
