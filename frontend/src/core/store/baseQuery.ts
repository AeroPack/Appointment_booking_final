import type { RootState } from '@/core/store/store'
import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { env } from '@/core/config/env'
import { setCredentials, logout } from '@/features/auth/authSlice'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.VITE_API_URL,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState
    const token = state.auth?.token
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  },
})

function unwrapData(raw: unknown): unknown {
  if (
    raw &&
    typeof raw === 'object' &&
    'data' in (raw as Record<string, unknown>)
  ) {
    return (raw as { data: unknown }).data
  }
  return raw
}

export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.data) {
    return { data: unwrapData(result.data), meta: result.meta }
  }

  if (result.error?.status === 401) {
    const state = api.getState() as RootState
    const refreshToken = state.auth?.refreshToken

    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        {
          url: '/api/auth/refresh',
          method: 'POST',
          body: { refresh_token: refreshToken },
        },
        api,
        extraOptions,
      )

      if (refreshResult.data) {
        const data = unwrapData(refreshResult.data) as {
          accessToken: string
          refreshToken: string
        }

        const currentUser = state.auth?.user
        if (currentUser) {
          api.dispatch(
            setCredentials({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: currentUser,
            }),
          )
        }

        const retryResult = await rawBaseQuery(args, api, extraOptions)
        if (retryResult.data) {
          return { data: unwrapData(retryResult.data), meta: retryResult.meta }
        }
        return retryResult
      }
    }

    api.dispatch(logout())
  }

  return result
}
