import { api } from '@/core/store/baseApi'

interface DoctorStats {
  total_patients: number
  booked: number
  finished: number
  no_show: number
}

interface TodayPatient {
  id: string
  patient_id: string
  patient_name: string
  phone: string | null
  gender: string | null
  age: number | null
  token_number: number
  scheduled_start: string
  appointment_status: string
  appointment_type: string
  venue_name: string | null
  reason: string
}

interface TypeCount {
  type: string
  count: number
}

interface VenueTypeStat {
  venue_id: string
  venue_name: string
  types: TypeCount[]
  total: number
}

interface DateRange {
  from?: string
  to?: string
}

export const doctorDashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDoctorStats: builder.query<DoctorStats, DateRange>({
      query: (params) => ({
        url: '/api/doctor/stats',
        params: params.from && params.to ? params : undefined,
      }),
      providesTags: ['Doctor'],
    }),
    getDoctorPatients: builder.query<TodayPatient[], DateRange>({
      query: (params) => ({
        url: '/api/doctor/patients',
        params: params.from && params.to ? params : undefined,
      }),
      providesTags: ['Doctor'],
    }),
    getVenueTypeStats: builder.query<VenueTypeStat[], DateRange>({
      query: (params) => ({
        url: '/api/doctor/venue-type-stats',
        params: params.from && params.to ? params : undefined,
      }),
      providesTags: ['Doctor'],
    }),
  }),
})

export const {
  useGetDoctorStatsQuery,
  useGetDoctorPatientsQuery,
  useGetVenueTypeStatsQuery,
} = doctorDashboardApi
