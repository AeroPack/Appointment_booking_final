import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/core/store/hooks'
import { useRegisterMutation, useVerifyRegistrationOtpMutation, useUpdateProfileMutation, useSetupWhatsAppMutation } from '@/features/auth/authApi'
import { setCredentials } from '@/features/auth/authSlice'
import { extractErrorMessage } from '@/features/auth/errorMessage'
import { BasicInfoStep } from './components/BasicInfoStep'
import { ProfileStep } from './components/ProfileStep'
import { WhatsAppStep } from './components/WhatsAppStep'

type Step = 'basic' | 'otp' | 'profile' | 'whatsapp' | 'complete'

interface SignupData {
  name: string
  email?: string
  mobile_number?: string
  password: string
}

interface ProfileData {
  title?: 'Dr.' | 'Prof.' | 'Mr.' | 'Ms.'
  speciality?: string
  qualification?: string
  registration_number?: string
  consultation_fee?: number
  experience_years?: number
  bio?: string
}

interface WhatsAppData {
  whatsapp_enabled?: boolean
  ultramsg_instance_id?: string
  ultramsg_token?: string
  whatsapp_number?: string
}

export function SignupFlow() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [step, setStep] = useState<Step>('basic')
  const [signupData, setSignupData] = useState<SignupData | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const MAX_RESENDS = 5

  const [register, { isLoading: isRegistering }] = useRegisterMutation()
  const [verifyRegistrationOtp, { isLoading: isVerifyingOtp }] = useVerifyRegistrationOtpMutation()
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateProfileMutation()
  const [setupWhatsApp, { isLoading: isSettingUpWhatsApp }] = useSetupWhatsAppMutation()

  // Countdown timer effect
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [secondsLeft > 0])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const handleBasicInfoSubmit = useCallback(
    async (data: SignupData) => {
      setError(undefined)
      try {
        const result = await register(data).unwrap()
        setUserId(result.user_id)
        setSignupData(data)
        setSecondsLeft(result.expires_in)
        setStep('otp')
      } catch (err: unknown) {
        setError(extractErrorMessage(err, 'Registration failed'))
      }
    },
    [register],
  )

  const handleOtpVerify = useCallback(
    async (otp: string) => {
      setError(undefined)
      try {
        if (!userId) return
        const result = await verifyRegistrationOtp({ user_id: userId, otp }).unwrap()
        dispatch(setCredentials(result))
        setStep('profile')
      } catch (err: unknown) {
        setError(extractErrorMessage(err, 'Invalid OTP'))
      }
    },
    [verifyRegistrationOtp, userId, dispatch],
  )

  const handleProfileSubmit = useCallback(
    async (data: ProfileData) => {
      setError(undefined)
      try {
        await updateProfile(data).unwrap()
        setStep('whatsapp')
      } catch (err: unknown) {
        setError(extractErrorMessage(err, 'Failed to update profile'))
      }
    },
    [updateProfile],
  )

  const handleWhatsAppSubmit = useCallback(
    async (data: WhatsAppData) => {
      setError(undefined)
      try {
        await setupWhatsApp(data).unwrap()
        navigate('/doctor/dashboard', { replace: true })
      } catch (err: unknown) {
        setError(extractErrorMessage(err, 'Failed to configure WhatsApp'))
      }
    },
    [setupWhatsApp, navigate],
  )

  const handleSkipWhatsApp = useCallback(() => {
    navigate('/doctor/dashboard', { replace: true })
  }, [navigate])

  const handleResendOtp = useCallback(async () => {
    if (!signupData || resendCount >= MAX_RESENDS) return
    setError(undefined)
    try {
      const result = await register(signupData).unwrap()
      setSecondsLeft(result.expires_in)
      setResendCount((prev) => prev + 1)
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to resend code'))
    }
  }, [register, signupData, resendCount, MAX_RESENDS])

  if (step === 'otp' && signupData) {
    return (
      <BasicInfoStep
        mode="otp"
        identifier={signupData.email || signupData.mobile_number || ''}
        secondsLeft={secondsLeft}
        onVerify={handleOtpVerify}
        onResend={handleResendOtp}
        onBack={() => setStep('basic')}
        isLoading={isVerifyingOtp}
        error={error}
        canResend={resendCount < MAX_RESENDS}
      />
    )
  }

  if (step === 'profile') {
    return (
      <ProfileStep
        onSubmit={handleProfileSubmit}
        onSkip={() => setStep('whatsapp')}
        isLoading={isUpdatingProfile}
        error={error}
      />
    )
  }

  if (step === 'whatsapp') {
    return (
      <WhatsAppStep
        onSubmit={handleWhatsAppSubmit}
        onSkip={handleSkipWhatsApp}
        isLoading={isSettingUpWhatsApp}
        error={error}
      />
    )
  }

  return (
    <BasicInfoStep
      mode="signup"
      onSubmit={handleBasicInfoSubmit}
      isLoading={isRegistering}
      error={error}
    />
  )
}
