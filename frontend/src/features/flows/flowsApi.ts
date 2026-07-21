import { api } from '@/core/store/baseApi';
import type { FlowSummary, FlowDetail, FlowVersion, FlowGraph } from './flowTypes';

export const flowsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFlows: builder.query<FlowSummary[], void>({
      query: () => '/api/doctor/flows',
      providesTags: ['BookingFlow'],
    }),

    getFlowDetail: builder.query<FlowDetail, string>({
      query: (flowId) => `/api/doctor/flows/${flowId}`,
      providesTags: (_result, _error, flowId) => [{ type: 'BookingFlow', id: flowId }],
    }),

    getVersion: builder.query<FlowVersion, { flowId: string; versionId: string }>({
      query: ({ flowId, versionId }) => `/api/doctor/flows/${flowId}/versions/${versionId}`,
    }),

    createFlow: builder.mutation<FlowSummary, { name: string; trigger_type?: string }>({
      query: (body) => ({
        url: '/api/doctor/flows',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BookingFlow'],
    }),

    autosaveDraft: builder.mutation<{ success: boolean }, { flowId: string; versionId: string; graph: FlowGraph }>({
      query: ({ flowId, versionId, graph }) => ({
        url: `/api/doctor/flows/${flowId}/versions/${versionId}`,
        method: 'PUT',
        body: graph,
      }),
    }),

    getOrCreateDraft: builder.mutation<FlowVersion, string>({
      query: (flowId) => ({
        url: `/api/doctor/flows/${flowId}/draft`,
        method: 'POST',
      }),
    }),

    publishVersion: builder.mutation<{ success: boolean }, { flowId: string; versionId: string }>({
      query: ({ flowId, versionId }) => ({
        url: `/api/doctor/flows/${flowId}/versions/${versionId}/publish`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { flowId }) => [
        { type: 'BookingFlow', id: flowId },
        'BookingFlow',
      ],
    }),

    rollbackToVersion: builder.mutation<{ success: boolean }, { flowId: string; versionId: string }>({
      query: ({ flowId, versionId }) => ({
        url: `/api/doctor/flows/${flowId}/rollback`,
        method: 'POST',
        body: { version_id: versionId },
      }),
      invalidatesTags: (_result, _error, { flowId }) => [
        { type: 'BookingFlow', id: flowId },
        'BookingFlow',
      ],
    }),
  }),
});

export const {
  useGetFlowsQuery,
  useGetFlowDetailQuery,
  useGetVersionQuery,
  useCreateFlowMutation,
  useAutosaveDraftMutation,
  useGetOrCreateDraftMutation,
  usePublishVersionMutation,
  useRollbackToVersionMutation,
} = flowsApi;
