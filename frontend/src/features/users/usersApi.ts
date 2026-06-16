import { api } from '@/core/store/baseApi'
import type {
  UserProfile,
  UpdateProfileInput,
  CreateDependentInput,
  UpdateDependentInput,
} from './types'

export interface CreatePatientInput {
  name: string
  mobile_number?: string
  email?: string
  date_of_birth?: string
  address?: string
}

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<UserProfile, void>({
      query: () => '/api/users/me',
      providesTags: ['User'],
    }),
    updateMe: builder.mutation<UserProfile, UpdateProfileInput>({
      query: (body) => ({ url: '/api/users/me', method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
    getDependents: builder.query<UserProfile[], void>({
      query: () => '/api/users/dependents',
      providesTags: ['Dependent'],
    }),
    createDependent: builder.mutation<UserProfile, CreateDependentInput>({
      query: (body) => ({ url: '/api/users/dependents', method: 'POST', body }),
      invalidatesTags: ['Dependent'],
    }),
    updateDependent: builder.mutation<UserProfile, { id: string; data: UpdateDependentInput }>({
      query: ({ id, data }) => ({ url: `/api/users/dependents/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['Dependent'],
    }),
    deleteDependent: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/users/dependents/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Dependent'],
    }),
    searchPatients: builder.query<UserProfile[], { q: string }>({
      query: (params) => ({ url: '/api/patients/search', params }),
    }),
    createPatient: builder.mutation<UserProfile, CreatePatientInput>({
      query: (body) => ({ url: '/api/patients', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
  }),
})

export const {
  useGetMeQuery,
  useUpdateMeMutation,
  useGetDependentsQuery,
  useCreateDependentMutation,
  useUpdateDependentMutation,
  useDeleteDependentMutation,
  useSearchPatientsQuery,
  useCreatePatientMutation,
} = usersApi
