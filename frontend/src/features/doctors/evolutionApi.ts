import { api } from '@/core/store/baseApi'

export interface EvolutionStatus {
  instanceName: string
  status: 'disconnected' | 'connecting' | 'connected'
  qrcode?: string
}

export const evolutionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getWhatsAppStatus: builder.query<EvolutionStatus, void>({
      query: () => '/api/doctor/whatsapp/status',
      providesTags: ['Doctor'],
    }),
    connectWhatsApp: builder.mutation<EvolutionStatus, { phoneNumber: string }>({
      query: (body) => ({
        url: '/api/doctor/whatsapp/connect',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Doctor'],
    }),
    getQrCode: builder.query<EvolutionStatus, void>({
      query: () => '/api/doctor/whatsapp/qr',
      providesTags: ['Doctor'],
    }),
    disconnectWhatsApp: builder.mutation<{ disconnected: boolean }, void>({
      query: () => ({
        url: '/api/doctor/whatsapp/disconnect',
        method: 'POST',
      }),
      invalidatesTags: ['Doctor'],
    }),
  }),
})

export const {
  useGetWhatsAppStatusQuery,
  useConnectWhatsAppMutation,
  useGetQrCodeQuery,
  useDisconnectWhatsAppMutation,
} = evolutionApi
