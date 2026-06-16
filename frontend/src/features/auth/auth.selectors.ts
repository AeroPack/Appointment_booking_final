import type { RootState } from '@/core/store/store'

export const selectToken = (state: RootState) => state.auth.token
export const selectAuthUser = (state: RootState) => state.auth.user
export const selectAuthMobile = (state: RootState) => state.auth.mobile
export const selectIsAuthenticated = (state: RootState) => Boolean(state.auth.token)
