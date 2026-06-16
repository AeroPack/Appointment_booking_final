import { api } from '@/core/store/baseApi'

interface DoctorStats {
  total_patients: number
  booked: number
  finished: number
  no_show: number
}

interface TodayPatient {
  id: string
  patient_name: string
  token_number: number
  scheduled_start: string
  appointment_status: string
  venue_name: string | null
}

interface DateParam {
  date?: string
}

export const doctorDashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDoctorStats: builder.query<DoctorStats, DateParam>({
      query: (params) => ({
        url: '/api/doctor/stats',
        params: params.date ? params : undefined,
      }),
      providesTags: ['Doctor'],
    }),
    getTodayPatients: builder.query<TodayPatient[], DateParam>({
      query: (params) => ({
        url: '/api/doctor/today-patients',
        params: params.date ? params : undefined,
      }),
      providesTags: ['Doctor'],
    }),
  }),
})

export const { useGetDoctorStatsQuery, useGetTodayPatientsQuery } = doctorDashboardApi
