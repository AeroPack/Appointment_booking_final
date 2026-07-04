import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/core/store/hooks'
import { useRequestOtpMutation, useVerifyOtpMutation } from '@/features/auth/authApi'
import { setCredentials, setIdentifier } from '@/features/auth/authSlice'
import { selectAuthIdentifier } from '@/features/auth/auth.selectors'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { OtpForm } from '@/features/auth/components/OtpForm'

type Step = 'login' | 'otp'

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
        
        const value = identifierData.email || identifierData.mobile_number || '';
        dispatch(setIdentifier(value))
        setLocalIdentifier(value)
        setSecondsLeft(result.expires_in)
        setStep('otp')
      } catch (err: unknown) {
        const errPayload =
          err && typeof err === 'object' && 'data' in err
            ? (err as { data: { error?: { code?: string; message?: string } } }).data?.error
            : null
        const code = errPayload?.code ?? ''
        const msg = errPayload?.message ?? 'Failed to send OTP'
        setError(code ? `[${code}] ${msg}` : msg)
      }
    },
    [requestOtp, dispatch],
  )

  const handleVerifyOtp = useCallback(
    async (otp: string) => {
      setError(undefined)
      try {
        const payload: any = { otp };
        if (identifier.includes('@')) {
          payload.email = identifier;
        } else {
          payload.mobile_number = identifier;
        }

        const result = await verifyOtp(payload).unwrap()
        console.debug('[verifyOtp] result:', result)
        dispatch(setCredentials(result))
        const role = result.user.role
        const path =
          role === 'patient'
            ? '/patient/home'
            : role === 'doctor'
              ? '/doctor/dashboard'
              : '/staff/dashboard'
        navigate(path, { replace: true })
      } catch (err: unknown) {
        const errPayload =
          err && typeof err === 'object' && 'data' in err
            ? (err as { data: { error?: { code?: string; message?: string } } }).data?.error
            : null
        const code = errPayload?.code ?? ''
        const msg = errPayload?.message ?? 'Invalid OTP'
        setError(code ? `[${code}] ${msg}` : msg)
      }
    },
    [verifyOtp, identifier, dispatch, navigate],
  )

  const handleResendOtp = useCallback(async () => {
    const payload = identifier.includes('@') 
      ? { email: identifier } 
      : { mobile_number: identifier };
    await handleRequestOtp(payload)
  }, [handleRequestOtp, identifier])

  const handleChangeIdentifier = useCallback(() => {
    setStep('login')
    setError(undefined)
  }, [])

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

  return (
    <LoginForm
      onSubmit={handleRequestOtp}
      isLoading={isRequestingOtp}
      error={error}
    />
  )
}
