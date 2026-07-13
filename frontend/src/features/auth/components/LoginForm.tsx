import React, { useState } from 'react'
import { ArrowRight, Loader2, Plus, Stethoscope, User } from 'lucide-react'
import { Button } from '@/core/components/ui/button'
import { Card, CardContent } from '@/core/components/ui/card'
import { Input } from '@/core/components/ui/input'
import { Link } from 'react-router-dom'

export interface LoginFormProps {
  onRequestOtp: (identifier: { mobile_number?: string; email?: string }) => void
  onPasswordLogin: (data: { email_or_mobile: string; password: string }) => void
  onForgotPassword: () => void
  isLoading: boolean
  error?: string
}

export const LoginForm: React.FC<LoginFormProps> = ({ onRequestOtp, onPasswordLogin, onForgotPassword, isLoading, error }) => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient')
  const [emailMode, setEmailMode] = useState(false)
  const [value, setValue] = useState('')
  const [password, setPassword] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!emailMode) {
      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
      setValue(val)
    } else {
      setValue(e.target.value)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    if (role === 'doctor') {
      onPasswordLogin({ email_or_mobile: value, password })
      return
    }

    if (emailMode) {
      onRequestOtp({ email: value })
    } else {
      onRequestOtp({ mobile_number: value })
    }
  }

  const setIdentifierMode = (wantEmail: boolean) => {
    if (wantEmail === emailMode) return
    setEmailMode(wantEmail)
    setValue('')
    setPassword('')
  }

  const switchRole = (nextRole: 'patient' | 'doctor') => {
    setRole(nextRole)
    setValue('')
    setPassword('')
  }

  const isIdentifierValid = emailMode
    ? value.includes('@') && value.includes('.')
    : value.length === 10

  const isValid = role === 'doctor'
    ? isIdentifierValid && password.length > 0
    : isIdentifierValid

  return (
    <main className="min-h-screen flex flex-col items-center md:justify-center justify-start px-5 py-12 relative overflow-hidden bg-background">
      <div className="hidden md:block absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden md:block absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 flex flex-col items-center md:mt-0 mt-8">
        <div className="flex flex-col items-center text-center mb-6 md:mb-8">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0f766e] rounded-full flex items-center justify-center mb-6 shadow-sm transform hover:scale-105 transition-transform duration-300">
            <Plus className="text-white w-8 h-8 md:w-10 md:h-10" strokeWidth={3} />
          </div>
          <h1 className="text-[22px] md:text-[24px] font-bold leading-[28px] md:leading-[32px] tracking-[-0.01em] text-foreground px-4 md:px-0">
            Book your appointment in seconds
          </h1>
          <p className="hidden md:block text-[16px] leading-[24px] text-muted-foreground max-w-[320px] mt-2">
            Access professional healthcare with simplicity and serenity.
          </p>
        </div>

        <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-border md:rounded-xl">
          <CardContent className="p-0 md:p-8">
            <div className="flex p-1 bg-muted rounded-lg mb-6">
              <button
                type="button"
                onClick={() => switchRole('patient')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[14px] font-semibold rounded-md transition-all ${role === 'patient' ? 'bg-white text-[#0f766e] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <User className="w-4 h-4" />
                Patient / Staff
              </button>
              <button
                type="button"
                onClick={() => switchRole('doctor')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[14px] font-semibold rounded-md transition-all ${role === 'doctor' ? 'bg-white text-[#0f766e] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Stethoscope className="w-4 h-4" />
                Doctor
              </button>
            </div>
            <p className="text-[12px] text-muted-foreground -mt-4 mb-5">
              {role === 'doctor' ? 'Doctors sign in with a password.' : 'Patients and staff sign in with a one-time code.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="identifier"
                    className="block text-[14px] font-semibold leading-[20px] text-foreground tracking-[0.01em]"
                  >
                    {emailMode ? 'Email Address' : 'Phone Number'}
                  </label>
                  <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setIdentifierMode(false)}
                      className={`px-2.5 py-1 text-[12px] font-medium rounded transition-all ${!emailMode ? 'bg-white text-[#0f766e] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Phone
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdentifierMode(true)}
                      className={`px-2.5 py-1 text-[12px] font-medium rounded transition-all ${emailMode ? 'bg-white text-[#0f766e] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Email
                    </button>
                  </div>
                </div>
                <div className={`flex items-center border rounded-lg overflow-hidden transition-all duration-200 h-[48px] bg-white
                  ${error ? 'border-destructive focus-within:ring-destructive' : 'border-border focus-within:border-[#0f766e] focus-within:ring-1 focus-within:ring-[#0f766e]'}
                `}>
                  {!emailMode && (
                    <div className="bg-muted px-4 flex items-center border-r border-border h-full">
                      <span className="text-[16px] font-semibold text-muted-foreground">+91</span>
                    </div>
                  )}
                  <Input
                    id="identifier"
                    name="identifier"
                    type={emailMode ? 'email' : 'tel'}
                    placeholder={emailMode ? 'example@email.com' : (window?.innerWidth < 768 ? '00000 00000' : 'Enter 10-digit number')}
                    value={value}
                    onChange={handleInputChange}
                    required
                    className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 text-[16px] text-foreground placeholder:text-muted-foreground/50 h-full rounded-none bg-transparent"
                  />
                </div>
              </div>

              {role === 'doctor' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-[14px] font-semibold leading-[20px] text-foreground tracking-[0.01em]"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="text-[13px] font-medium text-[#0f766e] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className={`flex items-center border rounded-lg overflow-hidden transition-all duration-200 h-[48px] bg-white
                    ${error ? 'border-destructive focus-within:ring-destructive' : 'border-border focus-within:border-[#0f766e] focus-within:ring-1 focus-within:ring-[#0f766e]'}
                  `}>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 text-[16px] text-foreground placeholder:text-muted-foreground/50 h-full rounded-none bg-transparent"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-[12px] font-medium leading-[16px] text-destructive -mt-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={!isValid || isLoading}
                className="w-full h-[48px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[14px] font-semibold tracking-[0.01em] transition-all duration-150 shadow-[0px_4px_12px_rgba(15,23,42,0.05)] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {role === 'doctor' ? 'Sign In' : 'Send OTP'}
                    <ArrowRight className="hidden md:block w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {role === 'doctor' && (
              <div className="mt-6 text-center">
                <p className="text-[14px] font-medium text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-[#0f766e] hover:underline">
                    Sign Up
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden md:flex justify-center gap-6 mt-6">
          <a href="#" className="text-[12px] font-medium text-muted-foreground hover:text-[#0f766e] transition-colors">Help Center</a>
          <a href="#" className="text-[12px] font-medium text-muted-foreground hover:text-[#0f766e] transition-colors">Privacy Policy</a>
          <a href="#" className="text-[12px] font-medium text-muted-foreground hover:text-[#0f766e] transition-colors">Terms</a>
        </div>
      </div>

      <footer className="hidden md:block absolute bottom-6 w-full text-center">
        <p className="text-[12px] font-medium text-muted-foreground opacity-60">
          © 2024 Aeropack Pvt Ltd. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
