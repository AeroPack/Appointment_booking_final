import React, { useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Plus } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Card, CardContent } from '@/core/components/ui/card'
import { Input } from '@/core/components/ui/input'
import { Link } from 'react-router-dom'
import { PasswordStrength } from '@/features/auth/components/PasswordStrength'

interface SignupModeProps {
  mode: 'signup'
  onSubmit?: (data: { name: string; email?: string; mobile_number?: string; password: string }) => void
  isLoading: boolean
  error?: string
}

interface OtpModeProps {
  mode: 'otp'
  identifier: string
  secondsLeft: number
  onVerify?: (otp: string) => void
  onResend?: () => void
  onBack?: () => void
  isLoading: boolean
  error?: string
}

type BasicInfoStepProps = SignupModeProps | OtpModeProps

export function BasicInfoStep(props: BasicInfoStepProps) {
  const [name, setName] = useState('')
  const [contactMode, setContactMode] = useState<'phone' | 'email'>('phone')
  const [contactValue, setContactValue] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState(Array(6).fill(''))

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (contactMode === 'phone') {
      val = val.replace(/[^0-9]/g, '').slice(0, 10)
    }
    setContactValue(val)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (/[^0-9]/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)

    if (value && index < 5) {
      const nextInput = document.querySelector(`input[name="otp-${index + 1}"]`) as HTMLInputElement
      nextInput?.focus()
    }
  }

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.querySelector(`input[name="otp-${index - 1}"]`) as HTMLInputElement
      prevInput?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (props.mode === 'signup' && props.onSubmit) {
      const data: { name: string; email?: string; mobile_number?: string; password: string } = {
        name,
        password,
      }
      if (contactMode === 'phone') {
        data.mobile_number = contactValue
      } else {
        data.email = contactValue
      }
      props.onSubmit(data)
    } else if (props.mode === 'otp' && props.onVerify) {
      props.onVerify(otp.join(''))
    }
  }

  const isSignupValid = props.mode === 'signup' && name.length >= 2 && 
    ((contactMode === 'phone' && contactValue.length === 10) || 
     (contactMode === 'email' && contactValue.includes('@') && contactValue.includes('.'))) &&
    password.length >= 8 && password === confirmPassword

  const isOtpComplete = props.mode === 'otp' && otp.every(digit => digit !== '')

  if (props.mode === 'otp') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
        <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-[#0f766e]/10 rounded-full flex items-center justify-center mb-6">
              <Plus className="text-[#005c55] w-8 h-8" strokeWidth={3} />
            </div>
            <h1 className="text-[22px] font-bold leading-[28px] text-text-primary">
              Verify your account
            </h1>
            <p className="text-[14px] leading-[20px] text-on-surface-variant mt-2">
              We've sent a 6-digit code to {props.identifier}
            </p>
          </div>

          <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-outline-variant/30 md:rounded-xl">
            <CardContent className="p-0 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      name={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(e, index)}
                      className={`w-10 h-14 md:w-12 md:h-20 text-center text-[24px] font-bold border rounded-lg bg-surface-container-low transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        props.error ? 'border-status-error' : 'border-outline-variant focus:border-primary'
                      }`}
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                {props.error && (
                  <p className="text-[12px] font-medium text-status-error text-center">
                    {props.error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={!isOtpComplete || props.isLoading}
                  className="w-full h-[48px] bg-primary hover:bg-primary-container text-white rounded-full text-[14px] font-semibold"
                >
                  {props.isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                {props.secondsLeft > 0 ? (
                  <p className="text-[14px] text-on-surface-variant">
                    Resend in {Math.floor(props.secondsLeft / 60)}:{(props.secondsLeft % 60).toString().padStart(2, '0')}
                  </p>
                ) : (
                  <button
                    onClick={props.onResend}
                    className="text-[14px] font-semibold text-primary hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>

              <button
                onClick={props.onBack}
                className="mt-4 flex items-center justify-center gap-2 w-full text-[14px] font-medium text-on-surface-variant hover:text-text-primary"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to signup
              </button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-[#0f766e] rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Plus className="text-white w-8 h-8" strokeWidth={3} />
          </div>
          <h1 className="text-[22px] font-bold leading-[28px] text-text-primary">
            Create your account
          </h1>
          <p className="text-[14px] leading-[20px] text-on-surface-variant mt-2">
            Join as a healthcare provider
          </p>
        </div>

        <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-outline-variant/30 md:rounded-xl">
          <CardContent className="p-0 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Dr. John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-[48px] border-outline-variant focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Contact Method
                </label>
                <div className="flex p-1 bg-surface-container-low rounded-lg">
                  <button
                    type="button"
                    onClick={() => { setContactMode('phone'); setContactValue(''); }}
                    className={`flex-1 py-2 text-[14px] font-medium rounded-md transition-all ${
                      contactMode === 'phone' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                  >
                    Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => { setContactMode('email'); setContactValue(''); }}
                    className={`flex-1 py-2 text-[14px] font-medium rounded-md transition-all ${
                      contactMode === 'email' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                  >
                    Email
                  </button>
                </div>

                {contactMode === 'phone' ? (
                  <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary h-[48px]">
                    <div className="bg-surface-container-low px-4 flex items-center border-r border-outline-variant h-full">
                      <span className="text-[16px] font-semibold text-on-surface-variant">+91</span>
                    </div>
                    <Input
                      type="tel"
                      placeholder="00000 00000"
                      value={contactValue}
                      onChange={handleContactChange}
                      required
                      className="border-0 focus-visible:ring-0 h-full rounded-none"
                    />
                  </div>
                ) : (
                  <Input
                    type="email"
                    placeholder="example@email.com"
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    required
                    className="h-[48px] border-outline-variant focus:border-primary"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className="h-[48px] border-outline-variant focus:border-primary"
                />
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-2">
                <label className="block text-[14px] font-semibold text-on-surface-variant">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  required
                  className={`h-[48px] ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-status-error focus:border-status-error'
                      : 'border-outline-variant focus:border-primary'
                  }`}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[12px] text-status-error">Passwords do not match</p>
                )}
              </div>

              {props.error && (
                <p className="text-[12px] font-medium text-status-error">{props.error}</p>
              )}

              <Button
                type="submit"
                disabled={!isSignupValid || props.isLoading}
                className="w-full h-[48px] bg-primary hover:bg-primary-container text-white rounded-full text-[14px] font-semibold"
              >
                {props.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[14px] text-on-surface-variant">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
