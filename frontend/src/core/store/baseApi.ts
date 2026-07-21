import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './baseQuery'

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['User', 'Appointment', 'Dependent', 'Doctor', 'ChatbotConfig', 'Faq', 'UserSettings', 'BookingFlow', 'FlowSession'],
  endpoints: () => ({}),
})
