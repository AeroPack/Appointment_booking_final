import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppDispatch } from '@/core/store/hooks'
import { useLoginPasswordMutation } from '@/features/auth/authApi'
import { setCredentials } from '@/features/auth/authSlice'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { ForgotPassword } from '@/features/auth/components/ForgotPassword'
import { extractErrorMessage } from '@/features/auth/errorMessage'
import type { AuthUser } from '@/features/auth/types'

// Doctor-only: doctors are permanent accounts and sign in with a password here.
// Patients are temporary, OTP-only, and have their own entry point - not this page.
type Step = 'login' | 'forgot-password'

function redirectPathForRole(role: AuthUser['role']): string {
  if (role === 'patient') return '/patient/home'
  if (role === 'doctor') return '/doctor/dashboard'
  return '/staff/dashboard'
}

export function AuthFlow() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [step, setStep] = useState<Step>('login')
  const [error, setError] = useState<string>()

  const [loginPassword, { isLoading: isLoggingIn }] = useLoginPasswordMutation()

  const handleForgotPassword = useCallback(() => {
    setError(undefined)
    setStep('forgot-password')
  }, [])

  const handleBackToLogin = useCallback(() => {
    setStep('login')
    setError(undefined)
  }, [])

  const handlePasswordLogin = useCallback(
    async (data: { email_or_mobile: string; password: string }) => {
      setError(undefined)
      try {
        const result = await loginPassword(data).unwrap()
        dispatch(setCredentials({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        }))
        navigate(redirectPathForRole(result.user.role), { replace: true })
      } catch (err: unknown) {
        const msg = extractErrorMessage(err, 'Login failed')
        toast.error(msg)
        setError(msg)
      }
    },
    [loginPassword, dispatch, navigate],
  )

  if (step === 'forgot-password') {
    return <ForgotPassword onBack={handleBackToLogin} />
  }

  return (
    <LoginForm
      onPasswordLogin={handlePasswordLogin}
      onForgotPassword={handleForgotPassword}
      isLoading={isLoggingIn}
      error={error}
    />
  )
}
