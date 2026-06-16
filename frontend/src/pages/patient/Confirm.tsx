import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  ArrowLeft, 
  User, 
  CalendarDays, 
  Building2, 
  Banknote, 
  Info, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';
import { Badge } from '@/core/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { selectBookingDraft, setBookingResult } from '@/features/appointments/bookingDraftSlice';
import { useBookSlotMutation } from '@/features/appointments/appointmentsApi';
import { useGetMeQuery } from '@/features/users/usersApi';

export const Confirm: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectBookingDraft);
  const { data: user } = useGetMeQuery();
  const [bookSlot, { isLoading }] = useBookSlotMutation();
  const [error, setError] = useState<string | null>(null);

  const patientName = user?.name ?? 'Patient';
  const doctorName = draft.doctorName || 'Doctor';
  const doctorSpecialty = draft.doctorSpecialty ?? '';
  const doctorImageUrl = draft.imageUrl ?? undefined;
  const appointmentDateTime = draft.selectedSlot
    ? `${new Date(draft.selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${draft.selectedSlot.displayTime}`
    : '';
  const duration = '';
  const venue = draft.selectedSlot?.venueName ?? '';
  const fee = draft.fee ?? 0;
  const doctorId = draft.doctorId;
  const scheduledStart = draft.selectedSlot?.scheduledStart ?? '';
  const idempotencyKey = draft.idempotencyKey;

  useEffect(() => {
    if (!doctorId || !scheduledStart) {
      navigate('/patient/home', { replace: true });
    }
  }, [doctorId, scheduledStart, navigate]);

  const handleConfirm = async () => {
    try {
      setError(null);
      const result = await bookSlot({
        doctor_id: doctorId,
        scheduled_start: scheduledStart,
        idempotency_key: idempotencyKey,
      }).unwrap();
      dispatch(setBookingResult(result));
      navigate('/patient/success');
    } catch (err) {
      setError('Booking failed. Please try again.');
    }
  };

  const handleBack = () => {
    navigate(-1);
  };
  const formattedFee = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(fee);

  const doctorInitials = doctorName
    .replace('Dr. ', '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] font-body-base relative overflow-x-hidden flex flex-col md:items-center md:justify-center">
      
      {/* --- DESKTOP AMBIENT BACKGROUND --- */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] rounded-full bg-[#005c55]/5 blur-3xl"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-[#006b5f]/5 blur-3xl"></div>
      </div>

      {/* ========================================== */}
      {/* MOBILE VIEW (Bottom Sheet Style)           */}
      {/* ========================================== */}
      <div className="md:hidden flex flex-col min-h-screen bg-[#d8dadc]/50">
        {/* Spacer to push content down simulating a bottom sheet */}
        <div className="flex-1" onClick={handleBack} />
        
        <div className="w-full bg-[#f7f9fb] rounded-t-[32px] shadow-2xl p-6 relative animate-in slide-in-from-bottom-full duration-500">
          {/* Drag Handle */}
          <div className="w-12 h-1.5 bg-[#bdc9c6] rounded-full mx-auto mb-8" />
          
          <header className="mb-6">
            <h1 className="text-[24px] font-bold text-[#191c1e] mb-1">Confirm booking</h1>
            <p className="text-[16px] text-[#3e4947]">Review your appointment details before finalizing.</p>
          </header>

          <div className="flex flex-col gap-4 mb-8">
            {/* Patient Card */}
            <Card className="border-0 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] rounded-xl overflow-hidden">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#6df5e1]/30 flex items-center justify-center text-[#006f64]">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[#64748B]">Patient</p>
                  <p className="text-[16px] font-semibold text-[#191c1e]">{patientName}</p>
                </div>
              </CardContent>
            </Card>

            {/* Doctor Card */}
            <Card className="border-0 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] rounded-xl overflow-hidden">
              <CardContent className="p-5 flex items-center gap-4">
                <Avatar className="w-12 h-12 shadow-sm border border-[#eceef0]">
                  <AvatarImage src={doctorImageUrl} alt={doctorName} className="object-cover" />
                  <AvatarFallback className="bg-[#0f766e] text-white font-semibold">{doctorInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[12px] font-medium text-[#64748B]">Doctor</p>
                  <p className="text-[16px] font-semibold text-[#191c1e]">{doctorName}</p>
                  <p className="text-[12px] font-medium text-[#005c55]">{doctorSpecialty}</p>
                </div>
              </CardContent>
            </Card>

            {/* Appointment Details Card */}
            <Card className="border-0 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] rounded-xl overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 flex items-center justify-between border-b border-[#eceef0]">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-[#005c55]" />
                    <div>
                      <p className="text-[12px] font-medium text-[#64748B]">Date & Time</p>
                      <p className="text-[16px] font-semibold text-[#191c1e]">{appointmentDateTime}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-[#0f766e] text-[#a3faef] hover:bg-[#0f766e] rounded-lg text-[12px] font-semibold px-2.5 py-1 border-0">
                    {duration}
                  </Badge>
                </div>
                
                <div className="p-5 flex items-center gap-3 border-b border-[#eceef0]">
                  <Building2 className="w-5 h-5 text-[#005c55]" />
                  <div>
                    <p className="text-[12px] font-medium text-[#64748B]">Venue</p>
                    <p className="text-[16px] font-semibold text-[#191c1e]">{venue}</p>
                  </div>
                </div>
                
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-[#005c55]" />
                    <p className="text-[14px] font-semibold text-[#191c1e]">Consultation Fee</p>
                  </div>
                  <p className="text-[20px] font-bold text-[#005c55]">{formattedFee}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 bg-[#f2f4f6] rounded-xl mb-8">
            <Info className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#3e4947] italic leading-relaxed">
              Note: Appointment timings are subject to slight variations based on clinical emergencies. We recommend arriving 10 minutes early.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleConfirm}
              disabled={isLoading || !draft.selectedSlot}
              className="w-full h-[48px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[16px] font-semibold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm booking"}
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </Button>
            <Button 
              onClick={handleBack}
              disabled={isLoading}
              variant="ghost" 
              className="w-full h-[48px] text-[#005c55] hover:text-[#005c55] hover:bg-transparent hover:underline rounded-full text-[16px] font-semibold transition-all"
            >
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* DESKTOP VIEW (Centered Modal-like Card)    */}
      {/* ========================================== */}
      <main className="hidden md:flex relative z-10 w-full max-w-[900px] mx-auto flex-col items-center p-6 lg:p-0">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[32px] font-bold text-[#005c55] mb-2 tracking-tight">Confirm booking</h1>
          <p className="text-[18px] text-[#3e4947] max-w-lg mx-auto">
            Please review your appointment details carefully before finalizing your reservation.
          </p>
        </div>

        {/* Main Card */}
        <Card className="w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)] border border-[#bdc9c6]/30 overflow-hidden flex flex-row">
          
          {/* Left Column: Image Area */}
          <div className="w-1/3 bg-[#f2f4f6] relative min-h-[350px]">
            <img 
              src={doctorImageUrl} 
              alt={doctorName} 
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#005c55]/80 via-[#005c55]/20 to-transparent" />
            <div className="absolute bottom-8 left-8 text-white pr-4">
              <p className="text-[14px] font-semibold uppercase tracking-wider opacity-90 mb-1">{doctorSpecialty}</p>
              <p className="text-[24px] font-bold leading-tight">{doctorName}</p>
            </div>
          </div>

          {/* Right Column: Content Area */}
          <div className="w-2/3 p-10 lg:p-12 flex flex-col justify-between">
            
            {/* 2x2 Grid for Details */}
            <div className="grid grid-cols-2 gap-y-10 gap-x-12 mb-10">
              
              {/* Patient */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#6df5e1]/30 flex items-center justify-center text-[#005c55] shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[#3e4947] uppercase tracking-wider mb-0.5">Patient</p>
                  <p className="text-[18px] font-semibold text-[#191c1e] leading-tight">{patientName}</p>
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#6df5e1]/30 flex items-center justify-center text-[#005c55] shrink-0">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[#3e4947] uppercase tracking-wider mb-0.5">Date & Time</p>
                  <p className="text-[18px] font-semibold text-[#191c1e] leading-tight">{appointmentDateTime}</p>
                </div>
              </div>

              {/* Venue */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#6df5e1]/30 flex items-center justify-center text-[#005c55] shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[#3e4947] uppercase tracking-wider mb-0.5">Venue</p>
                  <p className="text-[18px] font-semibold text-[#191c1e] leading-tight">{venue}</p>
                </div>
              </div>

              {/* Fee */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#6df5e1]/30 flex items-center justify-center text-[#005c55] shrink-0">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[#3e4947] uppercase tracking-wider mb-0.5">Consultation Fee</p>
                  <p className="text-[18px] font-semibold text-[#191c1e] leading-tight">{formattedFee}</p>
                </div>
              </div>

            </div>

            {/* Emergency Warning Box */}
            <div className="p-4 bg-[#ffdad6]/20 rounded-lg border border-[#ba1a1a]/10 flex items-start gap-3 mb-10">
              <Info className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
              <p className="text-[14px] font-semibold text-[#3e4947] leading-relaxed">
                Note: Appointment times may vary slightly in the event of hospital emergencies. We will notify you via SMS if there are any schedule changes.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-6 mt-auto">
              <Button 
                onClick={handleConfirm}
                disabled={isLoading || !draft.selectedSlot}
                className="px-8 h-[48px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full text-[16px] font-semibold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm booking"}
                {!isLoading && <ArrowRight className="w-5 h-5" />}
              </Button>
              <button 
                onClick={handleBack}
                disabled={isLoading}
                className="text-[#005c55] hover:text-[#0f766e] font-semibold text-[14px] flex items-center gap-1.5 group transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back
              </button>
            </div>

          </div>
        </Card>

        {/* Support Footer Text */}
        <div className="mt-10 text-center">
          <p className="text-[12px] font-medium text-[#3e4947]">
            Need help? Contact our support team at <span className="text-[#005c55] font-bold hover:underline cursor-pointer">1-800-SERENE</span>
          </p>
        </div>

      </main>
    </div>
  );
};