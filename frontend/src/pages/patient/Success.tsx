import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  CheckCircle2, 
  Ticket, 
  User as UserIcon, 
  Calendar, 
  MapPin, 
  ClipboardList, 
  Info,
  CalendarPlus,
  CalendarRange
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';
import { Badge } from '@/core/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { selectBookingDraft, resetBookingDraft } from '@/features/appointments/bookingDraftSlice';

export const Success: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectBookingDraft);

  const result = draft.bookingResult;
  const token = result?.token_number ? `#${result.token_number}` : '#12';
  const doctorName = draft.doctorName || 'Doctor';
  const doctorSpecialty = draft.doctorSpecialty ?? '';
  const doctorImageUrl = draft.imageUrl ?? undefined;
  const date = result?.scheduled_start
    ? new Date(result.scheduled_start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const timeRange = result?.scheduled_start && result?.scheduled_end
    ? `${new Date(result.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(result.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const venueName = result?.venue?.name ?? draft.selectedSlot?.venueName ?? '';
  const venueDetails = '';
  const consultationType = 'In-Person';

  useEffect(() => {
    if (!result) {
      navigate('/patient/home', { replace: true });
    }
    return () => { dispatch(resetBookingDraft()); };
  }, []);

  const handleViewAppointments = () => navigate('/patient/appointments');
  // Parsing slightly different formats for mobile view
  const shortDate = date ? (date.includes(',') ? (date.split(',')[1] ?? '').trim() : date) : '';
  const startTime = timeRange ? (timeRange.split('—')[0] ?? '').trim() : '';

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface antialiased font-body-base overflow-x-hidden">
    

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-5 py-12 md:py-20 w-full max-w-[768px] mx-auto">
        
        {/* Success Header Area */}
        <div className="flex flex-col items-center text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Mobile Success Icon */}
          <div className="md:hidden relative flex items-center justify-center w-24 h-24 bg-primary/10 rounded-full mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse" />
            <div className="relative flex items-center justify-center w-16 h-16 bg-primary rounded-full shadow-lg">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
          </div>

          {/* Desktop Success Icon */}
          <div className="hidden md:flex items-center justify-center w-24 h-24 bg-primary/10 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-primary" strokeWidth={2} />
          </div>

          <h1 className="text-[24px] md:text-[32px] font-bold text-primary tracking-tight mb-2">
            You're booked!
          </h1>
          <p className="text-[16px] md:text-[18px] text-on-surface-variant max-w-md px-4 leading-relaxed">
            <span className="md:hidden">Your appointment has been confirmed. We've sent a copy to your email.</span>
            <span className="hidden md:inline">Your appointment has been confirmed. A confirmation email has been sent to your registered address.</span>
          </p>
        </div>

        {/* Ticket Card */}
        <div className="w-full max-w-[340px] md:max-w-full bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] md:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)] overflow-hidden relative animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 border md:border-0 border-outline-variant/20">
          
          {/* ========================================== */}
          {/* MOBILE TICKET LAYOUT (Hidden on Desktop)   */}
          {/* ========================================== */}
          <div className="md:hidden">
            {/* Top Section */}
            <div className="p-6 pb-5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-0.5">Token Number</p>
                  <p className="text-[20px] font-bold text-primary">{token}</p>
                </div>
                <div className="bg-primary/5 p-2 rounded-lg text-primary">
                  <Ticket className="w-6 h-6" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 border border-surface-container">
                  <AvatarImage src={doctorImageUrl} alt={doctorName} className="object-cover" />
                  <AvatarFallback className="bg-surface-container text-primary font-semibold">
                    {doctorName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[14px] font-bold text-on-surface">{doctorName}</p>
                  <p className="text-[12px] font-medium text-text-muted mt-0.5">{doctorSpecialty}</p>
                </div>
              </div>
            </div>

            {/* Perforated Line */}
            <div className="relative h-px border-t border-dashed border-outline-variant/60 mx-4">
              <div className="absolute -left-6 -top-2.5 w-5 h-5 bg-background rounded-full shadow-inner border-r border-outline-variant/20" />
              <div className="absolute -right-6 -top-2.5 w-5 h-5 bg-background rounded-full shadow-inner border-l border-outline-variant/20" />
            </div>

            {/* Bottom Section */}
            <div className="p-6 pt-5 bg-surface-bright/30">
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <p className="text-[12px] font-medium text-text-muted mb-1.5">Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <p className="text-[14px] font-bold text-on-surface">{shortDate}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-text-muted mb-1.5">Time</p>
                  <div className="flex items-center gap-2">
                    <CalendarRange className="w-5 h-5 text-primary" />
                    <p className="text-[14px] font-bold text-on-surface">{startTime}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-medium text-text-muted mb-1.5">Venue</p>
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[14px] font-bold text-on-surface">{venueName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* DESKTOP TICKET LAYOUT (Hidden on Mobile)   */}
          {/* ========================================== */}
          <div className="hidden md:block">
            {/* Main Content Area */}
            <div className="p-8 pb-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-1">Appointment Token</p>
                  <h2 className="text-[24px] font-bold text-primary">{token}</h2>
                </div>
                <Badge variant="secondary" className="bg-secondary-container text-on-secondary-container hover:bg-secondary-container text-[14px] font-semibold px-4 py-1.5 border-0 rounded-lg">
                  Confirmed
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-y-10 gap-x-12">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/5 p-3 rounded-xl text-primary shrink-0">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-text-muted mb-1">Practitioner</p>
                    <p className="text-[14px] font-bold text-on-surface">{doctorName}</p>
                    {doctorSpecialty && <p className="text-[12px] font-medium text-on-surface-variant mt-0.5">{doctorSpecialty}</p>}
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-primary/5 p-3 rounded-xl text-primary shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-text-muted mb-1">Date & Time</p>
                    <p className="text-[14px] font-bold text-on-surface">{date}</p>
                    <p className="text-[12px] font-medium text-on-surface-variant mt-0.5">{timeRange}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-primary/5 p-3 rounded-xl text-primary shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-text-muted mb-1">Venue</p>
                    <p className="text-[14px] font-bold text-on-surface">{venueName}</p>
                    <p className="text-[12px] font-medium text-on-surface-variant mt-0.5">{venueDetails}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="bg-primary/5 p-3 rounded-xl text-primary shrink-0">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-text-muted mb-1">Consultation Type</p>
                    <p className="text-[14px] font-bold text-on-surface">{consultationType}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Perforated Line */}
            <div className="relative h-px border-t-2 border-dashed border-outline-variant/40 mx-8">
              <div className="absolute -left-12 -top-4 w-8 h-8 bg-background rounded-full shadow-inner border-r border-outline-variant/10" />
              <div className="absolute -right-12 -top-4 w-8 h-8 bg-background rounded-full shadow-inner border-l border-outline-variant/10" />
            </div>

            {/* Actions Area */}
            <div className="p-8 flex gap-4 justify-center">
              <Button 
                onClick={() => {}}
                className="flex-1 max-w-[280px] h-[48px] bg-primary hover:bg-primary-container text-white rounded-full font-semibold text-[14px] transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2"
              >
                <CalendarPlus className="w-5 h-5" />
                Add to calendar
              </Button>
              <Button 
                onClick={handleViewAppointments}
                variant="outline"
                className="flex-1 max-w-[280px] h-[48px] border-2 border-primary text-primary hover:bg-primary/5 rounded-full font-semibold text-[14px] transition-all active:scale-95 flex items-center justify-center gap-2 bg-transparent"
              >
                <CalendarRange className="w-5 h-5" />
                View my appointments
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* MOBILE BUTTONS (Outside card)              */}
        {/* ========================================== */}
        <div className="md:hidden mt-8 w-full max-w-[340px] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <Button 
            onClick={handleViewAppointments}
            className="w-full h-[48px] bg-primary hover:bg-primary-container text-white rounded-full font-semibold text-[14px] transition-all active:scale-95 shadow-sm"
          >
            View my appointments
          </Button>
          <Button 
            onClick={() => {}}
            variant="outline"
            className="w-full h-[48px] border border-primary text-primary hover:bg-primary/5 rounded-full font-semibold text-[14px] transition-all active:scale-95 flex items-center justify-center gap-2 bg-transparent"
          >
            <CalendarPlus className="w-5 h-5" />
            Add to calendar
          </Button>
        </div>

        {/* Helpful Tip / Footer Text */}
        <div className="mt-8 md:mt-10 animate-in fade-in duration-1000 delay-500">
          <p className="md:hidden text-[12px] font-medium text-text-muted text-center max-w-[280px] leading-relaxed">
            Please arrive 15 minutes before your scheduled time for check-in.
          </p>
          <p className="hidden md:flex items-center justify-center gap-2 text-[14px] font-medium text-text-muted text-center">
            <Info className="w-4 h-4" />
            Need to cancel or reschedule? Contact us at least 24 hours in advance.
          </p>
        </div>

      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block mt-auto py-8 px-10 border-t border-outline-variant/20 bg-surface/50">
        <div className="max-w-[1000px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] font-medium text-text-muted">
          <p>© 2023 Rajat Mohan Hospital Clinic. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Help Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
};