import { api } from '@/core/store/baseApi'
import type {
  DaySlots,
  FindSlotsQuery,
  BookSlotBody,
  BookingResponse,
  AppointmentRow,
} from './types'

interface FindSlotsResult {
  doctor_setting: { slot_duration_minutes: number; max_patients_per_slot: number };
  days: DaySlots[];
}

export const appointmentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    findSlots: builder.query<FindSlotsResult, FindSlotsQuery>({
      query: (params) => ({
        url: '/api/patient/find-slots',
        params,
      }),
    }),
    bookSlot: builder.mutation<BookingResponse, BookSlotBody>({
      query: (body) => ({ url: '/api/patient/book-slot', method: 'POST', body }),
      invalidatesTags: ['Appointment'],
    }),
    getMyAppointments: builder.query<AppointmentRow[], { status?: string }>({
      query: (params) => ({ url: '/api/patient/appointments', params }),
      providesTags: ['Appointment'],
    }),
    getAppointment: builder.query<AppointmentRow & { statusHistory: unknown[] }, string>({
      query: (id) => ({ url: `/api/patient/appointments/${id}` }),
      providesTags: (_result, _error, id) => [{ type: 'Appointment' as const, id }],
    }),
    cancelAppointment: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/api/patient/appointments/${id}/cancel`, method: 'PATCH' }),
      invalidatesTags: ['Appointment'],
    }),
    updateAppointmentStatus: builder.mutation<{ message: string }, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/api/appointments/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Appointment'],
    }),
    bookOnBehalf: builder.mutation<BookingResponse, {
      doctor_id: string;
      patient_id: string;
      scheduled_start: string;
      idempotency_key: string;
      appointment_type?: string;
    }>({
      query: (body) => ({ url: '/api/appointments/book', method: 'POST', body }),
      invalidatesTags: ['Appointment', 'Doctor'],
    }),
    rescheduleAppointment: builder.mutation<BookingResponse, {
      appointment_id: string;
      patient_id: string;
      scheduled_start: string;
      idempotency_key: string;
      appointment_type?: string;
    }>({
      query: ({ appointment_id, ...body }) => ({
        url: `/api/appointments/${appointment_id}/reschedule`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Appointment', 'Doctor'],
    }),
  }),
})

export const {
  useFindSlotsQuery,
  useBookSlotMutation,
  useGetMyAppointmentsQuery,
  useGetAppointmentQuery,
  useCancelAppointmentMutation,
  useUpdateAppointmentStatusMutation,
  useBookOnBehalfMutation,
  useRescheduleAppointmentMutation,
} = appointmentsApi
