import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppDispatch, useAppSelector } from '@/core/store/hooks'
import { useRequestOtpMutation, useVerifyOtpMutation, useLoginPasswordMutation } from '@/features/auth/authApi'
import { setCredentials, setIdentifier } from '@/features/auth/authSlice'
import { selectAuthIdentifier } from '@/features/auth/auth.selectors'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { OtpForm } from '@/features/auth/components/OtpForm'
import { ForgotPassword } from '@/features/auth/components/ForgotPassword'
import type { AuthUser } from '@/features/auth/types'

type Step = 'login' | 'otp' | 'forgot-password'

function redirectPathForRole(role: AuthUser['role']): string {
  if (role === 'patient') return '/patient/home'
  if (role === 'doctor') return '/doctor/dashboard'
  return '/staff/dashboard'
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const errPayload =
    err && typeof err === 'object' && 'data' in err
      ? (err as { data: { error?: { code?: string; message?: string } } }).data?.error
      : null
  return errPayload?.message ?? fallback
}

export function AuthFlow() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const storedIdentifier = useAppSelector(selectAuthIdentifier)

  const [step, setStep] = useState<Step>('login')
  const [identifier, setLocalIdentifier] = useState(storedIdentifier ?? '')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState<string>()

  const [requestOtp, { isLoading: isRequestingOtp }] = useRequestOtpMutation()
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOtpMutation()
  const [loginPassword, { isLoading: isLoggingIn }] = useLoginPasswordMutation()

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [secondsLeft])

  const handleRequestOtp = useCallback(
    async (identifierData: { mobile_number?: string; email?: string }) => {
      setError(undefined)
      try {
        const result = await requestOtp(identifierData).unwrap()

        const value = identifierData.email || identifierData.mobile_number || ''
        dispatch(setIdentifier(value))
        setLocalIdentifier(value)
        setSecondsLeft(result.expires_in)
        setStep('otp')
      } catch (err: unknown) {
        const msg = extractErrorMessage(err, 'Failed to send OTP')
        toast.error(msg)
        setError(msg)
      }
    },
    [requestOtp, dispatch],
  )

  const handleVerifyOtp = useCallback(
    async (otp: string) => {
      setError(undefined)
      try {
        const payload = identifier.includes('@')
          ? { email: identifier, otp }
          : { mobile_number: identifier, otp }

        const result = await verifyOtp(payload).unwrap()
        dispatch(setCredentials(result))
        navigate(redirectPathForRole(result.user.role), { replace: true })
      } catch (err: unknown) {
        const msg = extractErrorMessage(err, 'Invalid OTP')
        toast.error(msg)
        setError(msg)
      }
    },
    [verifyOtp, identifier, dispatch, navigate],
  )

  const handleResendOtp = useCallback(async () => {
    const payload = identifier.includes('@')
      ? { email: identifier }
      : { mobile_number: identifier }
    await handleRequestOtp(payload)
  }, [handleRequestOtp, identifier])

  const handleChangeIdentifier = useCallback(() => {
    setStep('login')
    setError(undefined)
  }, [])

  const handleForgotPassword = useCallback(() => {
    setError(undefined)
    setStep('forgot-password')
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

  const maskedIdentifier = identifier
    ? identifier.includes('@')
      ? `${identifier.slice(0, 2)}***${identifier.slice(identifier.lastIndexOf('@'))}`
      : '+91 XXXXXX' + identifier.slice(-4)
    : ''

  if (step === 'otp') {
    return (
      <OtpForm
        maskedNumber={maskedIdentifier}
        secondsLeft={secondsLeft}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onChangeNumber={handleChangeIdentifier}
        isLoading={isVerifyingOtp}
        isResending={isRequestingOtp}
        error={error}
      />
    )
  }

  if (step === 'forgot-password') {
    return <ForgotPassword onBack={handleChangeIdentifier} />
  }

  return (
    <LoginForm
      onRequestOtp={handleRequestOtp}
      onPasswordLogin={handlePasswordLogin}
      onForgotPassword={handleForgotPassword}
      isLoading={isRequestingOtp || isLoggingIn}
      error={error}
    />
  )
}
