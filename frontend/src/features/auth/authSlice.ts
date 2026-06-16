import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, AuthUser, VerifyOtpResponse } from './types'

const TOKEN_KEY = 'auth_token'
const REFRESH_KEY = 'auth_refresh_token'
const USER_KEY = 'auth_user'

const initialState: AuthState = {
  token: localStorage.getItem(TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  user: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })(),
  mobile: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<VerifyOtpResponse>) {
      state.token = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.user = action.payload.user
      state.mobile = null
      localStorage.setItem(TOKEN_KEY, action.payload.accessToken)
      localStorage.setItem(REFRESH_KEY, action.payload.refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
    },
    setMobile(state, action: PayloadAction<string>) {
      state.mobile = action.payload
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload))
    },
    logout(state) {
      state.token = null
      state.refreshToken = null
      state.user = null
      state.mobile = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})

export const { setCredentials, setMobile, setUser, logout } = authSlice.actions
export default authSlice.reducer
