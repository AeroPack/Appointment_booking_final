import type { RootState } from '@/core/store/store'

export const selectToken = (state: RootState) => state.auth.token
export const selectAuthUser = (state: RootState) => state.auth.user
export const selectAuthIdentifier = (state: RootState) => state.auth.identifier
export const selectIsAuthenticated = (state: RootState) => Boolean(state.auth.token)
