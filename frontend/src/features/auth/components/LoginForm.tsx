import React, { useState } from 'react';
import { ArrowRight, Loader2, Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';

export interface LoginFormProps {
  onSubmit(identifier: { mobile_number?: string; email?: string }): void;
  isLoading: boolean;
  error?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading, error }) => {
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [value, setValue] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (mode === 'phone') {
      val = val.replace(/[^0-9]/g, '').slice(0, 10);
    }
    setValue(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (mode === 'phone') {
      if (value.length === 10) {
        onSubmit({ mobile_number: value });
      }
    } else {
      if (value.includes('@') && value.includes('.')) {
        onSubmit({ email: value });
      }
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center md:justify-center justify-start px-5 py-12 relative overflow-hidden bg-background">
      {/* Ambient Background Decorations (Desktop Only) */}
      <div className="hidden md:block absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden md:block absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 flex flex-col items-center md:mt-0 mt-8">
        
        {/* Brand Logo & Headline Section */}
        <div className="flex flex-col items-center text-center mb-6 md:mb-8">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-[#0f766e] rounded-full flex items-center justify-center mb-6 shadow-sm transform hover:scale-105 transition-transform duration-300">
            <Plus className="text-white w-8 h-8 md:w-10 md:h-10" strokeWidth={3} />
          </div>
          
          <h1 className="text-[22px] md:text-[24px] font-bold leading-[28px] md:leading-[32px] tracking-[-0.01em] text-text-primary px-4 md:px-0">
            Book your appointment in seconds
          </h1>
          
          <p className="hidden md:block text-[16px] leading-[24px] text-on-surface-variant max-w-[320px] mt-2">
            Access professional healthcare with simplicity and serenity.
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full border-0 shadow-none bg-transparent md:bg-white md:shadow-[0px_4px_12px_rgba(15,23,42,0.05)] md:border md:border-outline-variant/30 md:rounded-xl">
          <CardContent className="p-0 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Mode Toggle */}
              <div className="flex p-1 bg-surface-container-low rounded-lg mb-6">
                <button
                  type="button"
                  onClick={() => { setMode('phone'); setValue(''); }}
                  className={`flex-1 py-2 text-[14px] font-medium rounded-md transition-all ${mode === 'phone' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-text-primary'}`}
                >
                  Phone
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('email'); setValue(''); }}
                  className={`flex-1 py-2 text-[14px] font-medium rounded-md transition-all ${mode === 'email' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-text-primary'}`}
                >
                  Email
                </button>
              </div>

              {/* Input Group */}
              <div className="space-y-2">
                <label 
                  htmlFor="identifier" 
                  className="block text-[14px] font-semibold leading-[20px] text-on-surface-variant md:text-text-primary tracking-[0.01em]"
                >
                  {mode === 'phone' ? 'Phone Number' : 'Email Address'}
                </label>
                
                <div className="relative group">
                  <div className={`flex items-center border rounded-lg overflow-hidden transition-all duration-200 h-[48px] bg-white
                    ${error ? 'border-status-error focus-within:ring-status-error' : 'border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'}
                  `}>
                    {mode === 'phone' && (
                      <div className="bg-surface-container-low px-4 flex items-center border-r border-outline-variant h-full">
                        <span className="text-[16px] font-semibold text-on-surface-variant">+91</span>
                      </div>
                    )}
                    <Input
                      id="identifier"
                      name="identifier"
                      type={mode === 'phone' ? 'tel' : 'email'}
                      placeholder={mode === 'phone' ? (window?.innerWidth < 768 ? "00000 00000" : "Enter 10-digit number") : "example@email.com"}
                      value={value}
                      onChange={handleInputChange}
                      required
                      className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 text-[16px] text-text-primary placeholder:text-on-surface-variant/50 h-full rounded-none bg-transparent"
                    />
                  </div>
                  
                  {/* Validation / Helper Text */}
                  {error ? (
                    <p className="text-[12px] font-medium leading-[16px] text-status-error mt-2">
                      {error}
                    </p>
                  ) : (
                    <>
                      <p className="md:hidden text-[12px] font-medium leading-[16px] text-on-surface-variant mt-2">
                        Enter your registered {mode === 'phone' ? 'mobile number' : 'email address'}
                      </p>
                      <p className="hidden md:block text-[12px] font-medium leading-[16px] text-on-surface-variant mt-2">
                        We'll use this to securely verify your identity.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <Button 
                type="submit" 
                disabled={(mode === 'phone' ? value.length !== 10 : !value.includes('@')) || isLoading}
                className="w-full h-[48px] bg-primary hover:bg-primary-container text-white rounded-full text-[14px] font-semibold tracking-[0.01em] transition-all duration-150 shadow-[0px_4px_12px_rgba(15,23,42,0.05)] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="hidden md:block w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Sub-Footer Text inside card context for desktop, below form for mobile */}
            <div className="mt-8 text-center">
              <p className="text-[12px] font-medium leading-[16px] text-text-secondary md:text-on-surface-variant">
                We'll {mode === 'phone' ? 'text' : 'email'} you a 6-digit code.
              </p>
              
              {/* Mobile Stepper Dots */}
              <div className="md:hidden mt-8 flex justify-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                <div className="w-2 h-2 rounded-full bg-primary/10"></div>
                <div className="w-2 h-2 rounded-full bg-primary/5"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Support/Legal Links */}
        <div className="hidden md:flex justify-center gap-6 mt-6">
          <a href="#" className="text-[12px] font-medium text-on-surface-variant hover:text-primary transition-colors">Help Center</a>
          <a href="#" className="text-[12px] font-medium text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="text-[12px] font-medium text-on-surface-variant hover:text-primary transition-colors">Terms</a>
        </div>
      </div>

      {/* Simple Accessibility Footer (Desktop) */}
      <footer className="hidden md:block absolute bottom-6 w-full text-center">
        <p className="text-[12px] font-medium text-on-surface-variant opacity-60">
          © 2024 Aeropack Pvt Ltd. All rights reserved.
        </p>
      </footer>
    </main>
  );
};
