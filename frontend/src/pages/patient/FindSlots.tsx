import React, { useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sun, Moon, ArrowRight, Check, Ban, ArrowLeft } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useFindSlotsQuery } from '@/features/appointments/appointmentsApi';
import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { selectSlot, setSelectedDate, selectBookingDraft } from '@/features/appointments/bookingDraftSlice';

export interface DateOption {
  id: string;
  label: string;
  date: string;
  month: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  period: 'Morning' | 'Evening';
  clinicName: string;
  bookedCount: number;
  totalCapacity: number;
  status: 'Available' | 'Full' | 'Fastest Choice' | 'Open';
}

function formatSlotDate(dateStr: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getDate();
  const monthName = d.toLocaleString('en-US', { month: 'short' });
  const weekDay = d.toLocaleString('en-US', { weekday: 'short' });

  let label = weekDay;
  if (dateStr === today) label = 'Today';
  else if (dateStr === tomorrowStr) label = 'Tomorrow';

  return { id: dateStr, label, date: String(dayNum), month: monthName };
}

function formatSlotTime(isoStart: string, _isoEnd: string) {
  const d = new Date(isoStart);
  const hour = d.getHours();
  const mins = d.getMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  const timeStr = `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
  return {
    id: isoStart,
    time: timeStr,
    period: (hour < 12 ? 'Morning' : 'Evening') as 'Morning' | 'Evening',
  };
}

export const FindSlots: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const draft = useAppSelector(selectBookingDraft);
  const doctorId = searchParams.get('doctorId') || draft.doctorId || '';

  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);

  const { data: slotsData } = useFindSlotsQuery(
    { doctor_id: doctorId, from: today, to: weekLater },
    { skip: !doctorId }
  );

  // Redirect to home if no doctor selected
  useEffect(() => {
    if (!doctorId) {
      navigate('/patient/home', { replace: true });
    }
  }, [doctorId, navigate]);

  // All dates that have available slots
  const dates = useMemo(() => {
    if (!slotsData?.days) return [];
    return slotsData.days
      .filter((d) => d.slots.length > 0)
      .map((d) => formatSlotDate(d.date));
  }, [slotsData]);

  // Auto-select first date with slots on initial load
  useEffect(() => {
    const firstDate = dates[0];
    if (firstDate && !draft.selectedDate) {
      dispatch(setSelectedDate(firstDate.id));
    }
  }, [dates, draft.selectedDate, dispatch]);

  // Slots filtered by the selected date only
  const filteredSlots = useMemo(() => {
    if (!slotsData?.days || !draft.selectedDate) return [];
    const day = slotsData.days.find((d) => d.date === draft.selectedDate);
    if (!day) return [];
    return day.slots.map((s) => {
      const formatted = formatSlotTime(s.start, s.end);
      return {
        ...formatted,
        clinicName: s.venue?.name ?? '',
        bookedCount: s.booked_count,
        totalCapacity: s.capacity,
        status: s.is_full ? 'Full' : 'Available',
      } as TimeSlot;
    });
  }, [slotsData, draft.selectedDate]);

  const selectedDateId = draft.selectedDate;
  const selectedSlotId = draft.selectedSlot?.scheduledStart ?? undefined;

  const morningSlots = filteredSlots.filter((s) => s.period === 'Morning');
  const eveningSlots = filteredSlots.filter((s) => s.period === 'Evening');

  const activeDate = dates.find((d) => d.id === selectedDateId);
  const activeSlot = filteredSlots.find((s) => s.id === selectedSlotId);

  const handleSelectDate = (id: string) => {
    dispatch(setSelectedDate(id));
  };
  const handleSelectSlot = (slotId: string) => {
    const slot = filteredSlots.find((s) => s.id === slotId);
    if (!slot) return;
    dispatch(selectSlot({
      selectedDate: draft.selectedDate,
      selectedSlot: {
        scheduledStart: slotId,
        scheduledEnd: '',
        displayTime: slot.time,
        venueId: null,
        venueName: slot.clinicName,
      },
    }));
  };

  const handleContinue = () => {
    navigate('/patient/confirm');
  };

  const renderSlotCard = (slot: TimeSlot) => {
    const isSelected = selectedSlotId === slot.id;
    const isFull = slot.status === 'Full';
    const fillPercentage = Math.min(100, Math.max(0, (slot.bookedCount / slot.totalCapacity) * 100));

    // Base container classes
    let containerClass =
      'w-full text-left transition-all duration-200 outline-none rounded-xl p-4 flex flex-col ';
    if (isFull) {
      containerClass +=
        'bg-surface-container-low opacity-60 grayscale cursor-not-allowed border border-outline-variant/30 md:border-outline-variant ';
    } else if (isSelected) {
      containerClass +=
        'bg-white border-2 border-primary md:border-primary-container md:ring-2 md:ring-primary/10 shadow-sm ';
    } else {
      containerClass +=
        'bg-white border border-outline-variant hover:border-primary shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer ';
    }

    return (
      <button
        key={slot.id}
        onClick={() => !isFull && handleSelectSlot(slot.id)}
        disabled={isFull}
        className={containerClass}
      >
        {/* --- MOBILE VIEW: MORNING --- */}
        <div className={`md:hidden ${slot.period === 'Morning' ? 'block' : 'hidden'} w-full`}>
          {isSelected ? (
            <div className="flex items-center justify-between">
              <div className="flex flex-col text-left">
                <span className="text-[20px] font-semibold text-primary leading-tight">{slot.time}</span>
                <span className="text-[12px] text-status-success font-medium flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span> Available
                </span>
              </div>
              <div className="bg-primary text-white p-1.5 rounded-full">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
            </div>
          ) : isFull ? (
            <div className="flex items-center justify-between">
              <div className="flex flex-col text-left">
                <span className="text-[20px] font-semibold text-outline leading-tight">{slot.time}</span>
                <span className="text-[12px] text-outline font-medium mt-1">Fully Booked</span>
              </div>
              <Ban className="text-outline w-5 h-5" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-semibold text-on-background leading-tight">{slot.time}</span>
                <span className="text-[12px] text-on-surface-variant font-medium">
                  {slot.bookedCount} / {slot.totalCapacity} Booked
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-700"
                  style={{ width: `${fillPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* --- MOBILE VIEW: EVENING --- */}
        <div className={`md:hidden ${slot.period === 'Evening' ? 'flex' : 'hidden'} flex-col items-center justify-center w-full`}>
          <span className="text-[14px] font-semibold text-on-background block mb-1">{slot.time}</span>
          <span className={`text-[11px] font-medium ${slot.status === 'Fastest Choice' ? 'text-status-success' : 'text-on-surface-variant'}`}>
            {isFull ? 'Full' : slot.status}
          </span>
        </div>

        {/* --- DESKTOP VIEW (Unified for both Morning & Evening) --- */}
        <div className="hidden md:flex flex-col gap-3 w-full">
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[20px] font-semibold leading-tight block ${isSelected ? 'text-primary' : (isFull ? 'text-on-surface-variant' : 'text-primary')}`}>
                {slot.time}
              </span>
              <span className="text-[12px] text-text-muted mt-1 block">{slot.clinicName}</span>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider ${isFull ? 'bg-outline-variant text-on-surface-variant' : 'bg-primary-container text-on-primary-container'}`}>
              {isFull ? 'Full' : 'Available'}
            </span>
          </div>
          <div className="space-y-1.5 mt-auto">
            <div className="flex justify-between text-[12px]">
              <span className="text-on-surface-variant">Capacity</span>
              <span className={`font-bold ${isFull ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                {slot.bookedCount}/{slot.totalCapacity} booked
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-outline' : 'bg-primary'}`}
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col font-body-base">


      <main className="max-w-[768px] mx-auto w-full px-4 md:px-10 pt-8 pb-32 flex flex-col flex-grow">
        {/* Doctor Info */}
        {draft.doctorName && (
          <section className="mb-4 md:mb-6">
            <button onClick={() => navigate('/patient/doctors')} className="flex items-center gap-1.5 text-primary text-[13px] font-semibold mb-2 hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Change doctor
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[14px] font-bold">
                {draft.doctorName.replace('Dr. ', '').charAt(0)}
              </div>
              <div>
                <p className="text-[16px] md:text-[18px] font-bold text-on-surface">{draft.doctorName}</p>
                <p className="text-[13px] text-primary font-medium">{draft.doctorSpecialty}</p>
              </div>
            </div>
          </section>
        )}
        {/* Heading */}
        <section className="mb-6 md:mb-8">
          <h1 className="text-[24px] md:text-[32px] font-bold text-on-background md:text-on-surface leading-tight tracking-tight mb-2">
            Choose a time
          </h1>
          <p className="hidden md:block text-[16px] text-on-surface-variant">
            Select your preferred appointment date and time slot.
          </p>
        </section>

        {/* Date Selector */}
        <section className="mb-8 md:mb-10 overflow-hidden -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4 snap-x">
            {dates.map((date) => {
              const isActive = date.id === selectedDateId;

              // Mobile styling (Pill)
              const mobileClass = isActive
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high';

              return (
                <button
                  key={date.id}
                   onClick={() => handleSelectDate(date.id)}
                  className={`flex-shrink-0 snap-start transition-all duration-200 active:scale-95 outline-none 
                    md:hidden flex flex-col items-center justify-center px-6 h-[48px] rounded-full ${mobileClass}
                  `}
                >
                  <span className="text-[14px] font-semibold">{date.label}</span>
                  <span className="text-[10px] opacity-80 uppercase tracking-wider">
                    {date.month} {date.date}
                  </span>
                </button>
              );
            })}
            {/* Re-map for Desktop explicitly to use classes correctly without conflicts */}
            {dates.map((date) => {
              const isActive = date.id === selectedDateId;
              const desktopClass = isActive
                ? 'border-2 border-primary bg-primary-container text-on-primary-container'
                : 'border border-outline-variant bg-surface hover:bg-surface-container-high';

              return (
                <button
                  key={`desktop-${date.id}`}
                   onClick={() => handleSelectDate(date.id)}
                  className={`hidden md:flex flex-shrink-0 snap-start flex-col items-center justify-center w-20 h-24 rounded-xl transition-all duration-200 active:scale-95 outline-none ${desktopClass}`}
                >
                  <span className={`text-[12px] uppercase tracking-wider ${isActive ? 'opacity-80' : 'text-on-surface-variant'}`}>
                    {date.label}
                  </span>
                  <span className="text-[20px] font-semibold mt-0.5">{date.date}</span>
                  <span className="text-[14px] font-semibold">{date.month}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Slots Container */}
        <div className="space-y-8 md:space-y-10 flex-grow">
          {/* Morning Section */}
          {morningSlots.length > 0 && (
            <section>
              <div className="flex items-center gap-2 md:gap-3 mb-4 text-on-surface-variant opacity-80 md:opacity-100 md:text-on-surface">
                <Sun className="w-5 h-5 md:text-primary" />
                <h2 className="text-[14px] font-semibold uppercase tracking-widest md:text-[20px] md:font-semibold md:normal-case md:tracking-normal">
                  Morning
                </h2>
              </div>
              <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                {morningSlots.map(renderSlotCard)}
              </div>
            </section>
          )}

          {/* Evening Section */}
          {eveningSlots.length > 0 && (
            <section>
              <div className="flex items-center gap-2 md:gap-3 mb-4 text-on-surface-variant opacity-80 md:opacity-100 md:text-on-surface">
                <Moon className="w-5 h-5 md:text-primary" />
                <h2 className="text-[14px] font-semibold uppercase tracking-widest md:text-[20px] md:font-semibold md:normal-case md:tracking-normal">
                  Evening
                </h2>
              </div>
              {/* Note: Mobile uses a 2-col grid for Evening regardless of desktop */}
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                {eveningSlots.map(renderSlotCard)}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Sticky Bottom Actions */}
      {/* Mobile Footer */}
      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent pt-8 z-50">
        <div className="max-w-[768px] mx-auto">
          <Button
            onClick={handleContinue}
            disabled={!selectedSlotId}
            className="w-full bg-primary text-white h-[56px] rounded-full text-[14px] font-semibold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Desktop Footer */}
      <div className="hidden md:block fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant/30 py-4 px-10 z-50 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
        <div className="max-w-[768px] mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] text-on-surface-variant uppercase font-bold tracking-widest">Selected Slot</p>
            <p className="text-[20px] font-semibold text-primary">
              {activeDate && activeSlot
                ? `${activeDate.label}, ${activeDate.month} ${activeDate.date} • ${activeSlot.time}`
                : 'No slot selected'}
            </p>
          </div>
          <Button
            onClick={handleContinue}
            disabled={!selectedSlotId}
            className="min-w-[200px] h-[48px] rounded-full bg-primary text-white text-[14px] font-semibold shadow-lg hover:bg-surface-tint transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};