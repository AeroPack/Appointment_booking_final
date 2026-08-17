import { api } from '@/core/store/baseApi'

export interface FaqEntry {
  id: string
  doctor_id: string
  question: string
  answer: string
  keywords: string[] | null
  created_at: string
}

export interface CreateFaqBody {
  question: string
  answer: string
  keywords?: string[]
}

export interface UpdateFaqBody {
  question?: string
  answer?: string
  keywords?: string[]
}

export const faqApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFaqs: builder.query<FaqEntry[], void>({
      query: () => '/api/doctor/faq',
      providesTags: ['Faq'],
    }),
    createFaq: builder.mutation<FaqEntry, CreateFaqBody>({
      query: (body) => ({
        url: '/api/doctor/faq',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Faq'],
    }),
    updateFaq: builder.mutation<FaqEntry, { id: string } & UpdateFaqBody>({
      query: ({ id, ...body }) => ({
        url: `/api/doctor/faq/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Faq'],
    }),
    deleteFaq: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/doctor/faq/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Faq'],
    }),
  }),
})

export const {
  useGetFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
} = faqApi
