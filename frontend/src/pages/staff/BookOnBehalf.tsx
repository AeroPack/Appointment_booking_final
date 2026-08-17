import { useState, useEffect } from 'react';
import {
  Search,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Calendar as CalendarIcon,
  ArrowRight,
  UserSearch,
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Avatar, AvatarFallback } from '@/core/components/ui/avatar';
import { useLazySearchPatientsQuery } from '@/features/users/usersApi';
import { useListDoctorsQuery } from '@/features/doctors/doctorsApi';
import { useFindSlotsQuery, useBookOnBehalfMutation } from '@/features/appointments/appointmentsApi';
import { toast } from 'sonner';

export function BookOnBehalf() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [triggerSearch, { data: searchResults, isLoading: isSearching }] = useLazySearchPatientsQuery();
  const { data: doctors, isLoading: isLoadingDoctors } = useListDoctorsQuery({});
  const [bookOnBehalf, { isLoading: isBooking }] = useBookOnBehalfMutation();

  const today = new Date().toISOString().slice(0, 10);
  const toDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const { data: slotData, isLoading: isLoadingSlots } = useFindSlotsQuery(
    { doctor_id: selectedDoctorId || '', from: today, to: toDate },
    { skip: !selectedDoctorId }
  );

  useEffect(() => {
    if (search.length >= 2) {
      triggerSearch({ q: search });
    }
  }, [search, triggerSearch]);

  const patients = searchResults ?? [];
  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const selectedDoctor = doctors?.find(d => d.id === selectedDoctorId);

  const availableDates = slotData?.days
    ?.filter(d => d.slots.some(s => s.available > 0))
    .map(d => d.date) ?? [];

  const slotsForDate = slotData?.days?.find(d => d.date === selectedDate)?.slots ?? [];

  const morningSlots = slotsForDate.filter(s => {
    const hour = new Date(s.start).getHours();
    return hour < 12;
  });
  const afternoonSlots = slotsForDate.filter(s => {
    const hour = new Date(s.start).getHours();
    return hour >= 12;
  });

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    setStep(2);
  };

  const handleSelectDoctor = (id: string) => {
    setSelectedDoctorId(id);
    setSelectedDate(null);
    setSelectedSlotStart(null);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlotStart(null);
  };

  const handleBook = async () => {
    if (!selectedPatientId || !selectedDoctorId || !selectedSlotStart) {
      toast.error('Please complete all selections');
      return;
    }
    try {
      await bookOnBehalf({
        doctor_id: selectedDoctorId,
        patient_id: selectedPatientId,
        scheduled_start: selectedSlotStart,
        idempotency_key: crypto.randomUUID(),
        notes: notes || undefined,
      }).unwrap();
      toast.success('Appointment booked successfully');
      setStep(1);
      setSelectedPatientId(null);
      setSelectedDoctorId(null);
      setSelectedDate(null);
      setSelectedSlotStart(null);
      setNotes('');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to book appointment');
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderSlot = (slot: { start: string; available: number; capacity: number; is_full: boolean }) => {
    const isSelected = selectedSlotStart === slot.start;
    const time = formatTime(slot.start);

    if (slot.is_full) {
      return (
        <button key={slot.start} disabled className="relative p-4 rounded-xl border border-outline-variant bg-surface-container-highest/50 cursor-not-allowed w-full text-left">
          <p className="font-label-bold text-label-bold text-outline line-through">{time}</p>
          <p className="font-label-sm text-label-sm text-outline mt-1">Full</p>
        </button>
      );
    }

    return (
      <button
        key={slot.start}
        onClick={() => setSelectedSlotStart(slot.start)}
        className={`p-4 rounded-xl transition-all group w-full text-left active:scale-95 ${
          isSelected
            ? 'border-2 border-primary bg-primary text-on-primary ring-4 ring-primary/10 shadow-md'
            : 'border border-outline-variant bg-surface-card hover:border-primary hover:text-primary cursor-pointer shadow-sm'
        }`}
      >
        <p className="font-label-bold text-label-bold">{time}</p>
        <p className={`font-label-sm text-label-sm mt-1 ${isSelected ? 'opacity-80' : 'text-on-surface-variant group-hover:text-primary'}`}>
          {isSelected ? 'Selected' : `${slot.available} left`}
        </p>
      </button>
    );
  };

  return (
    <>
      {/* MOBILE LAYOUT */}
      <div className="md:hidden flex flex-col min-h-screen bg-surface-container-lowest max-w-[768px] mx-auto pb-8">
        <div className="px-4 pt-8 pb-6 bg-surface-container-lowest sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-bold text-label-bold ${step >= 1 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`font-label-sm text-label-sm ${step >= 1 ? 'text-primary' : 'text-on-surface-variant'}`}>Search</span>
            </div>
            <div className={`h-[2px] flex-grow mx-2 ${step >= 2 ? 'bg-primary' : 'bg-outline-variant'}`} />
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-bold text-label-bold ${step >= 2 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                {step > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`font-label-sm text-label-sm ${step >= 2 ? 'text-primary' : 'text-on-surface-variant'}`}>Schedule</span>
            </div>
            <div className={`h-[2px] flex-grow mx-2 ${step >= 3 ? 'bg-primary' : 'bg-outline-variant'}`} />
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-bold text-label-bold ${step >= 3 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                3
              </div>
              <span className={`font-label-sm text-label-sm ${step >= 3 ? 'text-primary' : 'text-on-surface-variant'}`}>Confirm</span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4">
          {/* Mobile Step 1: Patient Search */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Patient Search</h1>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <Input
                  className="w-full h-12 pl-12 pr-4 bg-surface rounded-xl border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-body-base"
                  placeholder="Search by name, email or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                {isSearching ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#005c55]" /></div>
                ) : patients.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-8">Type at least 2 characters to search</p>
                ) : (
                  patients.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient.id)}
                      className="flex items-center justify-between p-4 bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container active:scale-95 transition-transform cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12 bg-surface-container-high text-on-surface-variant">
                          <AvatarFallback><UserSearch className="w-6 h-6" /></AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-label-bold text-label-bold">{patient.name}</p>
                          <p className="font-label-sm text-label-sm text-on-surface-variant">{patient.mobile_number || patient.email}</p>
                        </div>
                      </div>
                      <ChevronRight className="text-outline w-5 h-5" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Mobile Step 2: Select Doctor & Date */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setStep(1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Select Provider</h1>
              </div>

              <div className="mb-8 overflow-x-auto hide-scrollbar -mx-4 px-4 flex gap-4">
                {isLoadingDoctors ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#005c55] mx-auto" />
                ) : (
                  (doctors ?? []).map(doctor => {
                    const isSelected = selectedDoctorId === doctor.id;
                    return (
                      <div
                        key={doctor.id}
                        onClick={() => handleSelectDoctor(doctor.id)}
                        className={`flex-shrink-0 w-40 p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-primary-container border-2 border-primary text-on-primary-container'
                            : 'bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container text-on-surface opacity-70 hover:opacity-100'
                        }`}
                      >
                        <Avatar className={`w-16 h-16 mb-3 ${isSelected ? 'border-2 border-primary' : ''}`}>
                          <AvatarFallback>{doctor.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="font-label-bold text-label-bold">{doctor.name}</p>
                        <p className={`font-label-sm text-label-sm ${isSelected ? 'opacity-80' : 'text-on-surface-variant'}`}>{doctor.speciality || 'General'}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedDoctorId && (
                <>
                  <p className="font-label-bold text-label-bold mb-4">Available Dates</p>
                  {isLoadingSlots ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#005c55] mx-auto" />
                  ) : (
                    <div className="grid grid-cols-4 gap-3 mb-8">
                      {availableDates.slice(0, 4).map(date => (
                        <div
                          key={date}
                          onClick={() => handleSelectDate(date)}
                          className={`flex flex-col items-center p-3 rounded-xl cursor-pointer transition-all ${
                            selectedDate === date
                              ? 'bg-primary text-on-primary'
                              : 'bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container'
                          }`}
                        >
                          <span className={`font-label-sm text-label-sm ${selectedDate === date ? 'opacity-80' : 'text-outline'}`}>
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                          <span className="text-xl font-bold">{new Date(date + 'T00:00:00').getDate()}</span>
                          <span className={`font-label-sm text-label-sm ${selectedDate === date ? '' : 'text-outline'}`}>
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => setStep(3)}
                    disabled={!selectedDate}
                    className="w-full h-12 bg-primary text-on-primary rounded-full font-label-bold text-label-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Next: Choose Time
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Mobile Step 3: Select Slot & Confirm */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-24">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setStep(2)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Confirm Slot</h1>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <p className="font-label-bold text-label-bold">{formatDateLabel(selectedDate || today)}</p>
                <div className="flex items-center gap-2 text-status-success">
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span className="font-label-sm text-label-sm">{slotsForDate.filter(s => s.available > 0).length} slots available</span>
                </div>
              </div>

              {morningSlots.length > 0 && (
                <div className="mb-6">
                  <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-3 text-[12px]">Morning</p>
                  <div className="grid grid-cols-2 gap-3">
                    {morningSlots.map(slot => renderSlot(slot))}
                  </div>
                </div>
              )}

              {afternoonSlots.length > 0 && (
                <div className="mb-6">
                  <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-3 text-[12px]">Afternoon</p>
                  <div className="grid grid-cols-2 gap-3">
                    {afternoonSlots.map(slot => renderSlot(slot))}
                  </div>
                </div>
              )}

              <div className="mt-8 p-4 rounded-xl bg-surface-container-low border border-outline-variant">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Booking Summary</p>
                <div className="space-y-1">
                  <p className="font-body-base text-body-base"><strong>Patient:</strong> {selectedPatient?.name}</p>
                  <p className="font-body-base text-body-base"><strong>Doctor:</strong> {selectedDoctor?.name}</p>
                  {selectedSlotStart && <p className="font-body-base text-body-base"><strong>Time:</strong> {formatTime(selectedSlotStart)}</p>}
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white p-6 shadow-[0_-4px_20px_-2px_rgba(15,23,42,0.05)] rounded-t-3xl border-t border-surface-container z-50 max-w-[768px] mx-auto">
                <Button
                  onClick={handleBook}
                  disabled={!selectedSlotStart || isBooking}
                  className="w-full h-12 bg-primary text-on-primary rounded-full font-label-bold text-label-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isBooking ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Book Appointment <CheckCircle2 className="w-5 h-5" /></>}
                </Button>
                <p className="text-center mt-3 font-label-sm text-label-sm text-on-surface-variant">Booking on behalf of Staff Member</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:flex h-screen w-full flex-col overflow-hidden bg-background">
        <main className="flex-1 flex overflow-hidden">
          {/* Desktop Left Pane: Patient Selection */}
          <section className="w-[35%] lg:w-2/5 border-r border-outline-variant bg-surface flex flex-col p-8 gap-6 z-10 shadow-[2px_0_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
              <UserSearch className="w-8 h-8 text-primary" />
              <h1 className="font-headline-lg text-headline-lg text-primary">Patient Selection</h1>
            </div>

            <div className="relative group">
              <label className="font-label-bold text-label-bold text-on-surface-variant block mb-2">Search patient by name, email or phone</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <Input
                  className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 text-body-base"
                  placeholder="Type to search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3 pr-2">
              {isSearching ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#005c55]" /></div>
              ) : patients.length === 0 ? (
                <p className="text-center text-on-surface-variant py-8">Type at least 2 characters to search</p>
              ) : (
                patients.map(patient => {
                  const isSelected = selectedPatientId === patient.id;
                  return (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`p-4 rounded-xl flex items-center gap-4 cursor-pointer transition-transform active:scale-95 ${
                        isSelected
                          ? 'bg-primary-container border-2 border-primary'
                          : 'bg-surface-card border border-outline-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <Avatar className={`w-12 h-12 border-2 ${isSelected ? 'border-on-primary-container' : 'border-transparent bg-surface-container-highest'}`}>
                        <AvatarFallback><UserSearch className="w-5 h-5 text-outline" /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className={`font-label-bold text-label-bold ${isSelected ? 'text-on-primary-container' : 'text-on-surface'}`}>
                          {patient.name}
                        </p>
                        <p className={`font-label-sm text-label-sm ${isSelected ? 'text-on-primary-container opacity-80' : 'text-on-surface-variant'}`}>
                          {patient.mobile_number || patient.email}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="text-on-primary-container w-6 h-6 fill-current" />}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Desktop Right Pane: Schedule & Slots */}
          <section className="flex-1 bg-background flex flex-col overflow-hidden relative">
            <div className="p-8 flex flex-col gap-8 overflow-y-auto flex-1 hide-scrollbar pb-32">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-lg text-headline-lg text-primary">Appointment Schedule</h2>
                  {selectedDate && (
                    <div className="flex items-center gap-2 bg-surface-card border border-outline-variant px-4 py-2 rounded-xl shadow-sm">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                      <span className="font-label-bold text-label-bold">{formatDateLabel(selectedDate)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                  {isLoadingDoctors ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#005c55]" />
                  ) : (
                    (doctors ?? []).map(doctor => {
                      const isSelected = selectedDoctorId === doctor.id;
                      return (
                        <button
                          key={doctor.id}
                          onClick={() => handleSelectDoctor(doctor.id)}
                          className={`flex-shrink-0 flex items-center gap-3 p-3 rounded-xl min-w-[200px] transition-colors text-left ${
                            isSelected
                              ? 'border-2 border-primary bg-primary/5'
                              : 'border border-outline-variant bg-surface-card hover:bg-surface-container-high'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-outline">{doctor.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className={`font-label-bold text-label-bold ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>{doctor.name}</p>
                            <p className={`font-label-sm text-label-sm ${isSelected ? 'text-primary' : 'text-outline'}`}>{doctor.speciality || 'General'}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedDoctorId && (
                <>
                  <div>
                    <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-4 text-[12px]">Available Dates</p>
                    {isLoadingSlots ? (
                      <Loader2 className="w-6 h-6 animate-spin text-[#005c55]" />
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {availableDates.map(date => (
                          <button
                            key={date}
                            onClick={() => handleSelectDate(date)}
                            className={`flex-shrink-0 flex flex-col items-center p-4 rounded-xl min-w-[80px] transition-all ${
                              selectedDate === date
                                ? 'bg-primary text-on-primary'
                                : 'bg-white border border-outline-variant hover:border-primary'
                            }`}
                          >
                            <span className={`text-[12px] ${selectedDate === date ? 'opacity-80' : 'text-outline'}`}>
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span className="text-xl font-bold">{new Date(date + 'T00:00:00').getDate()}</span>
                            <span className={`text-[12px] ${selectedDate === date ? '' : 'text-outline'}`}>
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedDate && (
                    <div className="space-y-6">
                      {morningSlots.length > 0 && (
                        <div>
                          <h3 className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-4">Morning Sessions</h3>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {morningSlots.map(slot => renderSlot(slot))}
                          </div>
                        </div>
                      )}
                      {afternoonSlots.length > 0 && (
                        <div>
                          <h3 className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-4">Afternoon Sessions</h3>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {afternoonSlots.map(slot => renderSlot(slot))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="font-label-bold text-label-bold text-on-surface-variant block mb-2">Internal Admin Notes</label>
                    <textarea
                      className="w-full p-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body-base text-body-base outline-none resize-none"
                      placeholder="Add any special requirements or referral details..."
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        </main>

        {/* Desktop Sticky Footer */}
        <footer className="h-24 bg-surface border-t border-outline-variant px-8 flex items-center justify-between shadow-[0_-4px_20px_-2px_rgba(15,23,42,0.05)] z-20 shrink-0 w-full">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-headline-md text-headline-md text-on-surface">
                  {selectedDate ? formatDateLabel(selectedDate) : '...'} {selectedSlotStart ? `at ${formatTime(selectedSlotStart)}` : ''}
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  Patient: {selectedPatient?.name || '...'} | Doctor: {selectedDoctor?.name || '...'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" className="h-12 px-8 rounded-full border-outline text-on-surface-variant font-label-bold hover:bg-surface-container-high transition-colors">
              Cancel
            </Button>
            <Button
              onClick={handleBook}
              disabled={!selectedSlotStart || !selectedPatientId || isBooking}
              className="h-12 px-10 rounded-full bg-primary text-on-primary font-label-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isBooking ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Confirm Appointment <ArrowRight className="w-5 h-5" /></>}
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}

export default BookOnBehalf;
