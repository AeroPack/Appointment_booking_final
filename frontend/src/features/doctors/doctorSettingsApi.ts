import { api } from '@/core/store/baseApi'

export interface BookingPolicies {
  booking_min_notice_hours: number
  booking_max_advance_days: number
  auto_confirm_bookings: boolean
  cancellation_window_hours: number
}

export interface DoctorLeave {
  id: string
  doctor_id: string
  start_date: string
  end_date: string
  reason: string | null
  created_at: string
}

export interface WhatsAppConfig {
  ultramsg_instance_id: string | null
  ultramsg_token: string | null
  whatsapp_number: string | null
  whatsapp_enabled: boolean
}

export const doctorSettingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBookingPolicies: builder.query<BookingPolicies, void>({
      query: () => '/api/doctor/booking-policies',
      providesTags: ['Doctor'],
    }),
    updateBookingPolicies: builder.mutation<BookingPolicies, Partial<BookingPolicies>>({
      query: (body) => ({
        url: '/api/doctor/booking-policies',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Doctor'],
    }),
    getLeaves: builder.query<DoctorLeave[], void>({
      query: () => '/api/doctor/leaves',
      providesTags: ['Doctor'],
    }),
    createLeave: builder.mutation<DoctorLeave, { start_date: string; end_date: string; reason?: string }>({
      query: (body) => ({
        url: '/api/doctor/leaves',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Doctor'],
    }),
    deleteLeave: builder.mutation<{ deleted: boolean }, string>({
      query: (id) => ({
        url: `/api/doctor/leaves/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Doctor'],
    }),
    getWhatsAppConfig: builder.query<WhatsAppConfig, void>({
      query: () => '/api/clinic/whatsapp-config',
      providesTags: ['Doctor'],
    }),
    updateWhatsAppConfig: builder.mutation<WhatsAppConfig, Partial<WhatsAppConfig>>({
      query: (body) => ({
        url: '/api/clinic/whatsapp-config',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Doctor'],
    }),
  }),
})

export const {
  useGetBookingPoliciesQuery,
  useUpdateBookingPoliciesMutation,
  useGetLeavesQuery,
  useCreateLeaveMutation,
  useDeleteLeaveMutation,
  useGetWhatsAppConfigQuery,
  useUpdateWhatsAppConfigMutation,
} = doctorSettingsApi
