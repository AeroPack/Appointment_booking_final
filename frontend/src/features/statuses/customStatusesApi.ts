import { api } from '@/core/store/baseApi'

export interface CustomStatus {
  id: string
  name: string
  color: string | null
  sort_order: number
  is_system: boolean
}

export interface CreateCustomStatusBody {
  name: string
  color?: string
  sort_order?: number
}

export interface UpdateCustomStatusBody {
  name?: string
  color?: string | null
  sort_order?: number
}

export const customStatusesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCustomStatuses: builder.query<CustomStatus[], void>({
      query: () => '/api/custom-statuses',
      providesTags: ['CustomStatus'],
    }),
    getCustomStatus: builder.query<CustomStatus, string>({
      query: (id) => `/api/custom-statuses/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'CustomStatus', id }],
    }),
    createCustomStatus: builder.mutation<CustomStatus, CreateCustomStatusBody>({
      query: (body) => ({
        url: '/api/custom-statuses',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CustomStatus'],
    }),
    updateCustomStatus: builder.mutation<CustomStatus, { id: string } & UpdateCustomStatusBody>({
      query: ({ id, ...body }) => ({
        url: `/api/custom-statuses/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['CustomStatus'],
    }),
    deleteCustomStatus: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/custom-statuses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['CustomStatus'],
    }),
  }),
})

export const {
  useGetCustomStatusesQuery,
  useGetCustomStatusQuery,
  useCreateCustomStatusMutation,
  useUpdateCustomStatusMutation,
  useDeleteCustomStatusMutation,
} = customStatusesApi
