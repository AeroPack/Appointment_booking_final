import React, { useState, useCallback } from 'react';
import { ArrowLeft, Lock, Loader2, Mail, Phone, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import { OtpForm } from './OtpForm';
import { PasswordStrength } from './PasswordStrength';
import {
  useForgotPasswordMutation,
  useVerifyPasswordResetOtpMutation,
  useResetPasswordMutation,
} from '@/features/auth/authApi';

type Step = 'identifier' | 'otp' | 'new-password' | 'success';

function extractErrorMessage(err: unknown, fallback: string): string {
  const errPayload =
    err && typeof err === 'object' && 'data' in err
      ? (err as { data: { error?: { code?: string; message?: string } } }).data?.error
      : null;
  return errPayload?.message ?? fallback;
}

function maskIdentifier(value: string): string {
  if (value.includes('@')) {
    return `${value.slice(0, 2)}***${value.slice(value.lastIndexOf('@'))}`;
  }
  return '+91 XXXXXX' + value.slice(-4);
}

export const ForgotPassword: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [step, setStep] = useState<Step>('identifier');
  const [contactMode, setContactMode] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');
  const [identifier, setLocalIdentifier] = useState('');
  const [userId, setUserId] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [forgotPassword, { isLoading: isRequesting }] = useForgotPasswordMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyPasswordResetOtpMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetPasswordMutation();

  const identifierData = contactMode === 'phone'
    ? { mobile_number: value }
    : { email: value };

  const isValidIdentifier = contactMode === 'phone'
    ? value.length === 10
    : value.includes('@') && value.includes('.');

  const handleRequest = useCallback(async () => {
    setError(undefined);
    try {
      const result = await forgotPassword(identifierData).unwrap();
      setUserId(result.user_id);
      setLocalIdentifier(value);
      setSecondsLeft(result.expires_in);
      setStep('otp');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to send reset code');
      toast.error(msg);
      setError(msg);
    }
  }, [forgotPassword, identifierData, value]);

  const handleVerify = useCallback(async (otp: string) => {
    setError(undefined);
    try {
      await verifyOtp({ user_id: userId, otp }).unwrap();
      setVerifiedOtp(otp);
      setStep('new-password');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Invalid OTP');
      toast.error(msg);
      setError(msg);
    }
  }, [verifyOtp, userId]);

  const handleResend = useCallback(async () => {
    setError(undefined);
    try {
      const result = await forgotPassword(identifierData).unwrap();
      setUserId(result.user_id);
      setSecondsLeft(result.expires_in);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to resend code');
      toast.error(msg);
    }
  }, [forgotPassword, identifierData]);

  const handleChangeIdentifier = useCallback(() => {
    setStep('identifier');
    setError(undefined);
  }, []);

  const handleReset = useCallback(async () => {
    setError(undefined);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await resetPassword({ user_id: userId, otp: verifiedOtp, new_password: newPassword }).unwrap();
      setStep('success');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Password reset failed');
      toast.error(msg);
      setError(msg);
    }
  }, [resetPassword, userId, verifiedOtp, newPassword, confirmPassword]);

  if (step === 'success') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
        <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <KeyRound className="text-green-600 w-8 h-8" strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-bold leading-[28px] text-foreground">
              Password reset successful
            </h1>
            <p className="text-[14px] leading-[20px] text-muted-foreground mt-2">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>
          <Button
            type="button"
            onClick={onBack}
            className="w-full h-[48px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[14px] font-semibold"
          >
            Back to sign in
          </Button>
        </div>
      </main>
    );
  }

  if (step === 'otp') {
    return (
      <OtpForm
        maskedNumber={maskIdentifier(identifier)}
        secondsLeft={secondsLeft}
        onVerify={handleVerify}
        onResend={handleResend}
        onChangeNumber={handleChangeIdentifier}
        isLoading={isVerifying}
        isResending={isRequesting}
        error={error}
      />
    );
  }

  if (step === 'new-password') {
    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
    const canSubmit = newPassword.length >= 8 && passwordsMatch && !isResetting;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
        <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-[#0f766e]/10 rounded-full flex items-center justify-center mb-6">
              <Lock className="text-[#005c55] w-8 h-8" strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-bold leading-[28px] text-foreground">
              Set a new password
            </h1>
            <p className="text-[14px] leading-[20px] text-muted-foreground mt-2">
              Choose a strong password for your account.
            </p>
          </div>

          <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-border md:rounded-xl">
            <CardContent className="p-0 md:p-8">
              <button
                type="button"
                onClick={handleChangeIdentifier}
                className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-[#005c55] mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Change contact
              </button>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-[14px] font-semibold text-foreground">
                    New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-[48px] border-border focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
                  />
                  <PasswordStrength password={newPassword} />
                </div>

                <div className="space-y-2">
                  <label className="block text-[14px] font-semibold text-foreground">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`h-[48px] ${
                      confirmPassword && !passwordsMatch
                        ? 'border-destructive focus:border-destructive'
                        : 'border-border focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]'
                    }`}
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-[12px] text-destructive">Passwords do not match</p>
                  )}
                </div>

                {error && (
                  <p className="text-[12px] font-medium text-destructive -mt-2">{error}</p>
                )}

                <Button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleReset}
                  className="w-full h-[48px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[14px] font-semibold"
                >
                  {isResetting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reset password'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // step === 'identifier'
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-[440px] z-10 flex flex-col items-center">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-[#0f766e]/10 rounded-full flex items-center justify-center mb-6">
            <Lock className="text-[#005c55] w-8 h-8" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-bold leading-[28px] text-foreground">
            Reset your password
          </h1>
          <p className="text-[14px] leading-[20px] text-muted-foreground mt-2">
            Enter your email or phone number and we'll send you a code.
          </p>
        </div>

        <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-border md:rounded-xl">
          <CardContent className="p-0 md:p-8">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-[#005c55] mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>

            <div className="space-y-2">
              <label className="block text-[14px] font-semibold text-foreground">
                Contact Method
              </label>
              <div className="flex p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => { setContactMode('phone'); setValue(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[14px] font-medium rounded-md transition-all ${
                    contactMode === 'phone' ? 'bg-white text-[#0f766e] shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Phone
                </button>
                <button
                  type="button"
                  onClick={() => { setContactMode('email'); setValue(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[14px] font-medium rounded-md transition-all ${
                    contactMode === 'email' ? 'bg-white text-[#0f766e] shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
              </div>

              {contactMode === 'phone' ? (
                <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:border-[#0f766e] focus-within:ring-1 focus-within:ring-[#0f766e] h-[48px] bg-white">
                  <div className="bg-muted px-4 flex items-center border-r border-border h-full">
                    <span className="text-[16px] font-semibold text-muted-foreground">+91</span>
                  </div>
                  <Input
                    type="tel"
                    placeholder="00000 00000"
                    value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    className="border-0 focus-visible:ring-0 h-full rounded-none"
                  />
                </div>
              ) : (
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-[48px] border-border focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
                />
              )}
            </div>

            {error && (
              <p className="text-[12px] font-medium text-destructive mt-3">{error}</p>
            )}

            <Button
              type="button"
              disabled={!isValidIdentifier || isRequesting}
              onClick={handleRequest}
              className="w-full h-[48px] mt-5 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[14px] font-semibold"
            >
              {isRequesting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Send reset code'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
