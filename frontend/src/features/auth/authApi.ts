import { api } from '@/core/store/baseApi'
import type {
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from './types'

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    requestOtp: builder.mutation<RequestOtpResponse, RequestOtpRequest>({
      query: (body) => ({ url: '/api/auth/request-otp', method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<VerifyOtpResponse, VerifyOtpRequest>({
      query: (body) => ({ url: '/api/auth/verify-otp', method: 'POST', body }),
    }),
  }),
})

export const { useRequestOtpMutation, useVerifyOtpMutation } = authApi
