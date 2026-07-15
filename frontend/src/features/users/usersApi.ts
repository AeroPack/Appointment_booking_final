import { api } from '@/core/store/baseApi'
import type {
  UserProfile,
  UpdateProfileInput,
  CreateDependentInput,
  UpdateDependentInput,
  UserSettings,
  UpdateUserSettingsInput,
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
    uploadAvatar: builder.mutation<UserProfile, FormData>({
      query: (body) => ({ url: '/api/users/avatar', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    getUserSettings: builder.query<UserSettings, void>({
      query: () => '/api/user/settings',
      providesTags: ['UserSettings'],
    }),
    updateUserSettings: builder.mutation<UserSettings, UpdateUserSettingsInput>({
      query: (body) => ({ url: '/api/user/settings', method: 'PATCH', body }),
      invalidatesTags: ['UserSettings'],
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
  useUploadAvatarMutation,
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useGetDependentsQuery,
  useCreateDependentMutation,
  useUpdateDependentMutation,
  useDeleteDependentMutation,
  useSearchPatientsQuery,
  useCreatePatientMutation,
} = usersApi
