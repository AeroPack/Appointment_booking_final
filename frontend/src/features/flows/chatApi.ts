import { api } from '@/core/store/baseApi';

export interface FlowSession {
  id: string;
  flow_id: string;
  flow_version_id: string;
  doctor_id: string;
  patient_id: string | null;
  channel: 'whatsapp' | 'web';
  channel_session_id: string | null;
  current_node_id: string | null;
  context: Record<string, unknown>;
  status: 'idle' | 'running' | 'waiting_input' | 'completed' | 'error' | 'expired';
  error_message: string | null;
  step_count: number;
  started_at: string | null;
  last_activity_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowMessage {
  id: string;
  session_id: string;
  direction: 'outbound' | 'inbound';
  node_id: string | null;
  content: string;
  message_type: 'text' | 'choice' | 'api_request' | 'api_response' | 'system';
  channel_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface StartSessionResponse {
  session: FlowSession;
  messages: FlowMessage[];
}

export interface RespondSessionResponse {
  session: FlowSession;
  messages: FlowMessage[];
}

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    startFlowSession: builder.mutation<StartSessionResponse, { doctor_id: string; trigger_type?: string }>({
      query: (body) => ({
        url: '/api/flow-sessions',
        method: 'POST',
        body,
      }),
    }),

    respondToFlowSession: builder.mutation<RespondSessionResponse, { sessionId: string; input: string }>({
      query: ({ sessionId, input }) => ({
        url: `/api/flow-sessions/${sessionId}/respond`,
        method: 'POST',
        body: { input },
      }),
    }),

    getFlowSession: builder.query<FlowSession, string>({
      query: (sessionId) => `/api/flow-sessions/${sessionId}`,
    }),

    getFlowSessionMessages: builder.query<FlowMessage[], string>({
      query: (sessionId) => `/api/flow-sessions/${sessionId}/messages`,
      providesTags: (_result, _error, sessionId) => [{ type: 'FlowSession' as const, id: sessionId }],
    }),
  }),
});

export const {
  useStartFlowSessionMutation,
  useRespondToFlowSessionMutation,
  useGetFlowSessionQuery,
  useGetFlowSessionMessagesQuery,
} = chatApi;
