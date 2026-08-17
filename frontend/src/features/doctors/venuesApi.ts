import { api } from '@/core/store/baseApi'

export interface Venue {
  id: string
  clinic_id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
}

export const venuesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getVenues: builder.query<Venue[], void>({
      query: () => '/api/venues',
      providesTags: ['Venue'],
    }),
    createVenue: builder.mutation<Venue, Partial<Venue>>({
      query: (body) => ({
        url: '/api/venues',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Venue'],
    }),
    updateVenue: builder.mutation<Venue, Partial<Venue> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `/api/venues/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Venue'],
    }),
  }),
})

export const { useGetVenuesQuery, useCreateVenueMutation, useUpdateVenueMutation } = venuesApi
