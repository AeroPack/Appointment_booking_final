import { api } from '@/core/store/baseApi'
import type { DoctorOwnProfile, DoctorProfile, DoctorListItem, UpdateDoctorProfileInput } from './types'

export const doctorsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDoctorProfile: builder.query<DoctorProfile, string>({
      query: (id) => `/api/doctors/${id}/profile`,
      providesTags: (_result, _error, id) => [{ type: 'Doctor' as const, id }],
    }),
    listDoctors: builder.query<DoctorListItem[], { speciality?: string }>({
      query: (params) => ({ url: '/api/doctors', params }),
      providesTags: ['Doctor'],
    }),
    getOwnDoctorProfile: builder.query<DoctorOwnProfile, void>({
      query: () => '/api/doctor/profile',
      providesTags: ['Doctor'],
    }),
    updateDoctorProfile: builder.mutation<DoctorOwnProfile, UpdateDoctorProfileInput>({
      query: (body) => ({ url: '/api/doctor/profile', method: 'PATCH', body }),
      invalidatesTags: ['Doctor'],
    }),
  }),
})

export const {
  useGetDoctorProfileQuery,
  useListDoctorsQuery,
  useGetOwnDoctorProfileQuery,
  useUpdateDoctorProfileMutation,
} = doctorsApi
