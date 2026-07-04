import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, AuthUser, VerifyOtpResponse } from './types'

const TOKEN_KEY = 'auth_token'
const REFRESH_KEY = 'auth_refresh_token'
const USER_KEY = 'auth_user'
const IDENTIFIER_KEY = 'auth_identifier'

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
  identifier: localStorage.getItem(IDENTIFIER_KEY),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<VerifyOtpResponse>) {
      state.token = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.user = action.payload.user
      state.identifier = null
      localStorage.setItem(TOKEN_KEY, action.payload.accessToken)
      localStorage.setItem(REFRESH_KEY, action.payload.refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user))
      localStorage.removeItem(IDENTIFIER_KEY)
    },
    setIdentifier(state, action: PayloadAction<string>) {
      state.identifier = action.payload
      localStorage.setItem(IDENTIFIER_KEY, action.payload)
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload))
    },
    logout(state) {
      state.token = null
      state.refreshToken = null
      state.user = null
      state.identifier = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(IDENTIFIER_KEY)
    },
  },
})

export const { setCredentials, setIdentifier, setUser, logout } = authSlice.actions
export default authSlice.reducer
