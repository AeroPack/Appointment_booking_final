import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/core/store/hooks'
import { useRequestOtpMutation, useVerifyOtpMutation } from '@/features/auth/authApi'
import { setCredentials, setMobile } from '@/features/auth/authSlice'
import { selectAuthMobile } from '@/features/auth/auth.selectors'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { OtpForm } from '@/features/auth/components/OtpForm'

type Step = 'login' | 'otp'

export function AuthFlow() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const storedMobile = useAppSelector(selectAuthMobile)

  const [step, setStep] = useState<Step>('login')
  const [mobile, setLocalMobile] = useState(storedMobile ?? '')
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
    async (mobileNumber: string) => {
      setError(undefined)
      try {
        const result = await requestOtp({ mobile_number: mobileNumber }).unwrap()
        dispatch(setMobile(mobileNumber))
        setLocalMobile(mobileNumber)
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
        const result = await verifyOtp({
          mobile_number: mobile,
          otp,
        }).unwrap()
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
    [verifyOtp, mobile, dispatch, navigate],
  )

  const handleResendOtp = useCallback(async () => {
    await handleRequestOtp(mobile)
  }, [handleRequestOtp, mobile])

  const handleChangeNumber = useCallback(() => {
    setStep('login')
    setError(undefined)
  }, [])

  const maskedNumber = mobile
    ? '+91 XXXXXX' + mobile.slice(-4)
    : ''

  if (step === 'otp') {
    return (
      <OtpForm
        maskedNumber={maskedNumber}
        secondsLeft={secondsLeft}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onChangeNumber={handleChangeNumber}
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
