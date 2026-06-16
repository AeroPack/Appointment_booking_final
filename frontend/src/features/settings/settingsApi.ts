import { api } from '@/core/store/baseApi'
import type { MessageTemplateRow, UpdateTemplateInput } from '@/core/types/generated/settings'
import type { VenueRow } from '@/core/types/generated/doctors'

interface AppointmentSettingsResponse {
  doctor_id: string
  periods: Array<{
    day_of_week: number
    start_time: string
    end_time: string
    slot_duration_minutes: number
    max_patients_per_slot: number
    venue: { id: string; name: string } | null
  }>
  reminders: Array<{
    id: string
    template_type: string
    offset_minutes: number | null
    subject: string | null
    content: string
    channel: string
  }>
}

interface PutSettingsBody {
  doctor_id: string
  periods: Array<{
    day_of_week: number
    start_time: string
    end_time: string
    venue_id?: string
    slot_duration_minutes: number
    max_patients_per_slot: number
  }>
  reminders: Array<{
    template_type: string
    offset_minutes?: number
    subject?: string
    content: string
    channel?: string
  }>
}

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAppointmentSettings: builder.query<AppointmentSettingsResponse, string>({
      query: (doctorId) => ({ url: '/api/appointment-setting', params: { doctor_id: doctorId } }),
      providesTags: ['Doctor'],
    }),
    updateAppointmentSettings: builder.mutation<AppointmentSettingsResponse, PutSettingsBody>({
      query: (body) => ({ url: '/api/appointment-setting', method: 'PUT', body }),
      invalidatesTags: ['Doctor'],
    }),
    listTemplates: builder.query<MessageTemplateRow[], string | undefined>({
      query: (doctorId) => ({ url: '/api/message-templates', params: doctorId ? { doctor_id: doctorId } : undefined }),
      providesTags: ['Doctor'],
    }),
    updateTemplate: builder.mutation<MessageTemplateRow, { id: string; data: UpdateTemplateInput }>({
      query: ({ id, data }) => ({ url: `/api/message-templates/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['Doctor'],
    }),
    getVenues: builder.query<VenueRow[], void>({
      query: () => '/api/venues',
      providesTags: ['Doctor'],
    }),
  }),
})

export const {
  useGetAppointmentSettingsQuery,
  useUpdateAppointmentSettingsMutation,
  useListTemplatesQuery,
  useUpdateTemplateMutation,
  useGetVenuesQuery,
} = settingsApi
