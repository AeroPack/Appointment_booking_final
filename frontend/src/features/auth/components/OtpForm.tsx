import React, { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { ArrowLeft, Shield, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';

export interface OtpFormProps {
  maskedNumber: string;
  secondsLeft: number;
  onVerify: (otp: string) => void;
  onResend: () => void;
  onChangeNumber: () => void;
  isLoading: boolean;
  isResending?: boolean;
  error?: string;
}

export const OtpForm: React.FC<OtpFormProps> = ({
  maskedNumber,
  secondsLeft,
  onVerify,
  onResend,
  onChangeNumber,
  isLoading,
  isResending = false,
  error
}) => {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    if (/[^0-9]/.test(value)) return; // Only allow numbers

    const newOtp = [...otp];
    // Take only the last character if multiple are somehow typed
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      
      if (otp[index]) {
        // Clear current
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Move back and clear
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i] ?? '';
    }
    setOtp(newOtp);

    // Focus the next empty input or the last one
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length === 6 && !isLoading) {
      onVerify(otpString);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isComplete = otp.every(digit => digit !== '');

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Anchor */}
      <header className="w-full top-0 sticky bg-surface-container-lowest border-b border-outline-variant/50 z-50">
        <div className="flex items-center justify-between px-5 h-[48px] max-w-7xl mx-auto w-full">
          <button 
            onClick={onChangeNumber}
            aria-label="Go back" 
            className="flex items-center text-primary active:opacity-80 transition-opacity p-2 -ml-2"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[20px] font-semibold leading-[28px] text-primary">Rajat Mohan Hospital Clinic</h1>
          <div className="w-10"></div> {/* Spacer for center alignment */}
        </div>
      </header>

      <div className="flex-grow flex items-center justify-center p-5">
        {/* Verification Card Container */}
        <Card className="w-full max-w-[480px] bg-white border-0 shadow-none md:border md:border-outline-variant/30 md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:rounded-xl md:p-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CardContent className="p-0">
            {/* Branding Icon / Subtle Visual */}
            <div className="mb-6 flex justify-center mt-4 md:mt-0">
              <div className="w-16 h-16 bg-[#0f766e]/10 rounded-full flex items-center justify-center">
                <Shield className="text-[#005c55] w-8 h-8" strokeWidth={2} />
              </div>
            </div>

            {/* Content */}
            <h2 className="text-[24px] font-bold leading-[32px] tracking-[-0.01em] text-text-primary mb-2">
              Enter the code
            </h2>
            <p className="text-[16px] leading-[24px] text-on-surface-variant mb-6 md:mb-8">
              We've sent a 6-digit verification code to <br />
              <span className="font-bold text-text-primary">{maskedNumber}</span>
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* OTP Input Field Grid */}
              <div className="flex justify-between gap-2 md:gap-4 mb-2" id="otp-container">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className={`
                      w-12 h-14 md:w-16 md:h-20 text-center text-[24px] md:text-[30px] font-bold 
                      border rounded-lg bg-surface-container-low transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-primary/20
                      ${error 
                        ? 'border-status-error focus:border-status-error' 
                        : 'border-outline-variant focus:border-primary'
                      }
                    `}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>

              {/* Error Message */}
              <div className="min-h-[24px] mb-6 flex items-start justify-center">
                {error && (
                  <p className="text-[12px] font-medium text-status-error animate-in fade-in">
                    {error}
                  </p>
                )}
              </div>

              {/* Action Button */}
              <Button 
                type="submit"
                disabled={!isComplete || isLoading}
                className="w-full h-[48px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[14px] font-semibold tracking-[0.01em] transition-all duration-150 shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </form>

            {/* Footer Links & Countdown */}
            <div className="flex flex-col gap-2 items-center mt-2">
              {secondsLeft > 0 ? (
                <div className="text-[14px] font-semibold leading-[20px] text-on-surface-variant flex items-center gap-2">
                  <span>Resend in</span>
                  <span className="text-[#005c55]">{formatTime(secondsLeft)}</span>
                </div>
              ) : (
                <button
                  onClick={onResend}
                  type="button"
                  disabled={isResending}
                  className="text-[14px] font-semibold leading-[20px] text-[#005c55] hover:underline transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                >
                  {isResending ? 'Sending…' : 'Resend code'}
                </button>
              )}
              
              <button 
                onClick={onChangeNumber}
                type="button"
                className="text-[14px] font-semibold leading-[20px] text-on-surface-variant hover:text-[#005c55] transition-colors flex items-center gap-1 mt-3"
              >
                <Edit2 className="w-4 h-4" />
                Change number
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer Space */}
      <footer className="py-6 text-center mt-auto md:mt-0 border-t border-outline-variant/20 md:border-t-0">
        <p className="text-[12px] font-medium leading-[16px] text-outline">
          © 2024 Rajat Mohan Hospital Clinic. All rights reserved.
        </p>
      </footer>
    </main>
  );
};