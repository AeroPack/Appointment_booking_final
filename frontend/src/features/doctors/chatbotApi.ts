import { api } from '@/core/store/baseApi';

export interface ChatbotConfig {
  is_enabled: boolean;
  widget_key: string;
  typebot_embed_snippet: string | null;
}

export const chatbotApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getChatbotConfig: builder.query<ChatbotConfig, void>({
      query: () => '/api/doctor/chatbot-config',
      providesTags: ['ChatbotConfig'],
    }),
    updateChatbotConfig: builder.mutation<ChatbotConfig, { is_enabled: boolean }>({
      query: (body) => ({ url: '/api/doctor/chatbot-config', method: 'PUT', body }),
      invalidatesTags: ['ChatbotConfig'],
    }),
    regenerateWidgetKey: builder.mutation<{ widget_key: string }, void>({
      query: () => ({ url: '/api/doctor/chatbot-config/regenerate-widget-key', method: 'POST' }),
      invalidatesTags: ['ChatbotConfig'],
    }),
  }),
});

export const {
  useGetChatbotConfigQuery,
  useUpdateChatbotConfigMutation,
  useRegenerateWidgetKeyMutation,
} = chatbotApi;
