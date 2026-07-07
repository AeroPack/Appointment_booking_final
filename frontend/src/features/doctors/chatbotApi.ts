import { api } from '@/core/store/baseApi';

export interface ChatbotConfig {
  is_enabled: boolean;
  primary_color: string;
  greeting_msg: string;
  position: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const chatbotApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getChatbotConfig: builder.query<ChatbotConfig, void>({
      query: () => '/api/doctor/chatbot-config',
      providesTags: ['ChatbotConfig'],
    }),
    updateChatbotConfig: builder.mutation<ChatbotConfig, Partial<ChatbotConfig>>({
      query: (body) => ({ url: '/api/doctor/chatbot-config', method: 'PUT', body }),
      invalidatesTags: ['ChatbotConfig'],
    }),
    listFaq: builder.query<FaqEntry[], void>({
      query: () => '/api/doctor/faq',
      providesTags: ['Faq'],
    }),
    createFaq: builder.mutation<{ id: string }, { question: string; answer: string }>({
      query: (body) => ({ url: '/api/doctor/faq', method: 'POST', body }),
      invalidatesTags: ['Faq'],
    }),
    updateFaq: builder.mutation<void, { id: string; question?: string; answer?: string }>({
      query: ({ id, ...body }) => ({ url: `/api/doctor/faq/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Faq'],
    }),
    deleteFaq: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/doctor/faq/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Faq'],
    }),
  }),
});

export const {
  useGetChatbotConfigQuery,
  useUpdateChatbotConfigMutation,
  useListFaqQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
} = chatbotApi;
