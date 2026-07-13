import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Phone,
  ChevronRight,
  Edit,
  CheckCircle2,
  UserX,
  Loader2,
  Ticket,
  Clock,
  User,
  Stethoscope,
  Info,
  Plus,
  Printer,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';
import { useGetAppointmentQuery, useUpdateAppointmentStatusMutation } from '@/features/appointments/appointmentsApi';
//ok
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const AppointmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: appointment, isLoading } = useGetAppointmentQuery(id!, { skip: !id });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateAppointmentStatusMutation();

  const [notes, setNotes] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (appointment && !hasLoadedRef.current) {
      setNotes(appointment.notes || '');
      hasLoadedRef.current = true;
    }
  }, [appointment]);

  const saveNotes = useCallback(async (notesToSave: string) => {
    if (!id || !appointment) return;
    setNotesSaveStatus('saving');
    try {
      await updateStatus({
        id,
        status: appointment.appointment_status,
        notes: notesToSave,
      }).unwrap();
      setNotesSaveStatus('saved');
      setTimeout(() => setNotesSaveStatus('idle'), 2000);
    } catch {
      setNotesSaveStatus('idle');
    }
  }, [id, appointment, updateStatus]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(value);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        saveNotes(notes);
      }
    };
  }, [saveNotes, notes]);

  const handleMarkFinished = async () => {
    if (!id) return;
    await updateStatus({ id, status: 'finished' });
    setIsFinished(true);
    setTimeout(() => setIsFinished(false), 3000);
  };

  const handleNoShow = async () => {
    if (!id) return;
    await updateStatus({ id, status: 'no_show' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <p className="text-[#64748B]">Appointment not found.</p>
      </div>
    );
  }

  const timeSlot = `${formatTime(appointment.scheduled_start)} - ${formatTime(appointment.scheduled_end)}`;
  const duration = Math.round(
    (new Date(appointment.scheduled_end).getTime() - new Date(appointment.scheduled_start).getTime()) / 60000
  );
  const statusDisplay = appointment.appointment_status.charAt(0).toUpperCase() + appointment.appointment_status.slice(1);

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] font-body-base antialiased pb-24 lg:pb-12">

      {/* MOBILE HEADER */}
      <header className="lg:hidden w-full sticky top-0 z-40 bg-white shadow-sm border-b border-[#eceef0]">
        <div className="flex justify-between items-center px-4 h-[64px] max-w-[768px] mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-10 h-10 hover:bg-[#f2f4f6] transition-colors rounded-full active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-[#005c55]" />
            </button>
            <h1 className="text-[20px] font-semibold text-[#005c55]">Appointment Details</h1>
          </div>
          <Avatar className="w-10 h-10 border border-[#bdc9c6]">
            <AvatarImage src="/placeholder-doctor.jpg" alt="Doctor" />
            <AvatarFallback className="bg-[#0f766e] text-white">DR</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="max-w-[768px] lg:max-w-7xl mx-auto px-4 lg:px-10 py-6 lg:py-12">

        {/* DESKTOP HEADER */}
        <div className="hidden lg:flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#eceef0] transition-colors text-[#3e4947]"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-[32px] font-bold text-[#0F172A] tracking-tight leading-tight">Appointment Detail</h1>
            <p className="text-[16px] text-[#64748B]">Reviewing patient status and clinical notes</p>
          </div>
        </div>

        {/* MOBILE STATUS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 lg:hidden">
          <Card className="rounded-xl p-6 shadow-sm border-[#eceef0] flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[12px] font-medium text-[#64748B] mb-1">Appointment Time</p>
                <p className="text-[20px] font-semibold text-[#191c1e]">{formatTime(appointment.scheduled_start)}</p>
              </div>
              <Badge className="bg-[#6df5e1] text-[#006f64] hover:bg-[#6df5e1] border-0 px-3 py-1 rounded-lg flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#006b5f]"></span>
                {statusDisplay}
              </Badge>
            </div>
            <div className="pt-4 border-t border-[#f2f4f6] flex items-center gap-3">
              <Ticket className="w-5 h-5 text-[#005c55]" />
              <p className="text-[14px] font-semibold text-[#005c55]">Token #{appointment.token_number}</p>
            </div>
          </Card>

          <Card className="bg-[#005c55] text-white rounded-xl p-6 shadow-sm border-0 flex flex-col justify-center overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#a3faef] opacity-10 rounded-full pointer-events-none" />
            <div className="relative z-10">
              <p className="text-[12px] font-medium opacity-80 mb-1">Visit Type</p>
              <p className="text-[20px] font-semibold">General Consultation</p>
              <div className="mt-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#80d5cb]" />
                <span className="text-[12px] font-medium">Estimated duration: {duration} mins</span>
              </div>
            </div>
          </Card>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6 lg:space-y-8">

            {/* Patient Info Card */}
            <Card className="rounded-xl shadow-sm border-[#e0e3e5] overflow-hidden">
              <div className="lg:hidden p-4 border-b border-[#e0e3e5] flex items-center gap-3 bg-[#f2f4f6]">
                <User className="w-5 h-5 text-[#005c55]" />
                <h2 className="text-[14px] font-semibold text-[#191c1e] uppercase tracking-wider">Patient Information</h2>
              </div>

              <div className="p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4 lg:mb-6">
                  <div className="flex items-center gap-4 lg:gap-6 w-full lg:w-auto">
                    <Avatar className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl lg:rounded-full bg-[#f2f4f6] flex items-center justify-center shrink-0 border border-[#eceef0]">
                      <AvatarImage src="" alt={appointment.patient_name} className="object-cover" />
                      <AvatarFallback className="bg-[#0f766e] text-white font-bold text-xl">{getInitials(appointment.patient_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#191c1e]">{appointment.patient_name}</h2>
                      <p className="lg:hidden text-[16px] text-[#64748B] flex items-center gap-1 mt-1">
                        <Phone className="w-4 h-4" />
                        {appointment.doctor_mobile || '—'}
                      </p>
                      <p className="hidden lg:block text-[16px] text-[#64748B] mt-1">
                        Patient ID: {appointment.patient_id}
                      </p>
                    </div>
                  </div>

                  <button className="hidden lg:flex items-center gap-2 text-[#005c55] font-semibold text-[14px] hover:underline">
                    <History className="w-5 h-5" />
                    View Patient Records History
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mt-6 lg:mt-0 lg:pt-6 lg:border-t border-[#e0e3e5]">
                  <div className="hidden lg:block space-y-4">
                    <div>
                      <label className="text-[12px] font-medium text-[#64748B] block mb-1">Mobile Number</label>
                      <p className="text-[16px] text-[#191c1e]">{appointment.doctor_mobile || '—'}</p>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-[#64748B] block mb-1">Venue</label>
                      <p className="text-[16px] text-[#191c1e]">{appointment.venue_name || '—'}</p>
                    </div>
                  </div>

                  <div className="space-y-1 lg:space-y-4">
                    <label className="text-[12px] font-medium text-[#64748B] block mb-1 lg:mb-0">
                      Doctor
                    </label>
                    <div className="flex items-start gap-2 p-3 lg:p-0 bg-[#f7f9fb] lg:bg-transparent rounded-lg border border-[#bdc9c6] lg:border-none">
                      <p className="text-[16px] text-[#191c1e]">{appointment.doctor_name}</p>
                    </div>
                  </div>

                  <div className="space-y-1 lg:hidden">
                    <label className="text-[12px] font-medium text-[#64748B] block mb-1">Patient Records</label>
                    <button className="w-full h-[48px] flex items-center justify-between px-4 bg-[#f7f9fb] rounded-lg border border-[#bdc9c6] hover:bg-[#eceef0] transition-colors active:scale-[0.98]">
                      <span className="text-[16px] text-[#005c55] font-medium">View History</span>
                      <ChevronRight className="w-5 h-5 text-[#005c55]" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Clinical Notes Card */}
            <Card className="rounded-xl shadow-sm border-[#e0e3e5] lg:h-[calc(100%-min(280px,auto))] flex flex-col">
              <CardContent className="p-0 lg:p-8 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 px-1 lg:px-0 pt-1 lg:pt-0">
                  <label htmlFor="clinical-notes" className="text-[14px] lg:text-[20px] font-semibold text-[#191c1e] flex items-center gap-2">
                    <Edit className="w-4 h-4 lg:hidden text-[#005c55]" />
                    Clinical Notes
                  </label>
                  <span className="text-[12px] text-[#64748B] italic hidden lg:inline">
                    {notesSaveStatus === 'saving' ? 'Saving...' : notesSaveStatus === 'saved' ? 'Saved' : null}
                  </span>
                </div>

                <div className="relative flex-grow flex flex-col">
                  <Textarea
                    id="clinical-notes"
                    value={notes}
                    onChange={handleNotesChange}
                    placeholder="Enter observations, prescribed medications, or follow-up instructions here..."
                    className="w-full flex-grow min-h-[200px] lg:min-h-[320px] rounded-xl border border-[#bdc9c6] lg:border-[#e0e3e5] bg-white lg:bg-[#f7f9fb] p-4 lg:p-6 text-[16px] text-[#191c1e] focus-visible:ring-1 focus-visible:ring-[#005c55] focus-visible:border-[#005c55] resize-none transition-all placeholder:text-[#64748B]"
                  />
                  <div className="absolute right-3 bottom-3 text-[#6e7977] text-[10px] uppercase font-bold tracking-widest lg:hidden pointer-events-none">
                    {notesSaveStatus === 'saving' ? 'Saving...' : notesSaveStatus === 'saved' ? 'Saved' : null}
                  </div>
                  <div className="absolute bottom-4 right-4 hidden lg:flex gap-2">
                    <Button variant="secondary" className="bg-[#eceef0] hover:bg-[#e0e3e5] text-[#3e4947] font-semibold">
                      Add Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Actions */}
            <div className="lg:hidden grid grid-cols-1 gap-4 pt-2">
              <Button
                onClick={handleMarkFinished}
                disabled={isUpdating || isFinished}
                className={`w-full h-[56px] rounded-full font-semibold text-[16px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
                  isFinished
                    ? 'bg-[#16A34A] hover:bg-[#16A34A] text-white'
                    : 'bg-[#005c55] hover:bg-[#0f766e] text-white'
                }`}
              >
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isFinished ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Success
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Mark Finished
                  </>
                )}
              </Button>
              <div className="grid grid-cols-1 gap-4">
                <Button
                  onClick={handleNoShow}
                  disabled={isUpdating}
                  variant="outline"
                  className="h-[48px] border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 font-semibold rounded-xl"
                >
                  <UserX className="w-4 h-4 mr-2" /> Mark No-show
                </Button>
                {/* Cancel button intentionally hidden — doctor-initiated cancel is out of scope */}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (Desktop Only) */}
          <div className="hidden lg:flex lg:col-span-4 flex-col space-y-8">

            {/* Appointment Details Card */}
            <Card className="rounded-xl shadow-sm border-[#e0e3e5] p-8">
              <h3 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mb-6">Appointment Details</h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0f766e]/10 flex items-center justify-center text-[#005c55]">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#191c1e]">Time Slot</p>
                      <p className="text-[16px] text-[#64748B]">{timeSlot}</p>
                    </div>
                  </div>
                  <Badge className="bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/10 font-semibold text-[12px] px-3 py-1 border-0">
                    {statusDisplay}
                  </Badge>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#6df5e1]/20 flex items-center justify-center text-[#006b5f]">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#191c1e]">Token Number</p>
                    <p className="text-[16px] text-[#64748B]">{appointment.token_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#9c573a]/10 flex items-center justify-center text-[#7f4025]">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#191c1e]">Visit Type</p>
                    <p className="text-[16px] text-[#64748B]">General Consultation</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions Card */}
            <Card className="rounded-xl shadow-sm border-[#e0e3e5] p-8 space-y-4">
              <h3 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Actions</h3>

              <Button
                onClick={handleMarkFinished}
                disabled={isUpdating || isFinished}
                className={`w-full h-[48px] rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  isFinished
                    ? 'bg-[#16A34A] hover:bg-[#16A34A] text-white'
                    : 'bg-[#005c55] hover:bg-[#0f766e] text-white'
                }`}
              >
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isFinished ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Success
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Mark Finished
                  </>
                )}
              </Button>

              <Button
                onClick={handleNoShow}
                disabled={isUpdating}
                variant="outline"
                className="w-full h-[48px] rounded-full border-[#bdc9c6] text-[#3e4947] hover:bg-[#eceef0] font-semibold"
              >
                <UserX className="w-4 h-4 mr-2" /> Mark No-show
              </Button>

              <div className="pt-4 border-t border-[#e0e3e5]">
                <Button variant="ghost" className="w-full py-3 text-[#64748B] hover:text-[#191c1e] font-semibold hover:bg-transparent">
                  <Printer className="w-5 h-5 mr-2" /> Print Prescription
                </Button>
              </div>
            </Card>

            {/* Emergency Contact */}
            <div className="bg-[#0f766e]/5 rounded-xl p-6 border border-[#005c55]/10">
              <div className="flex gap-3">
                <Info className="w-6 h-6 text-[#005c55] shrink-0" />
                <div>
                  <p className="font-semibold text-[#005c55]">Emergency Contact</p>
                  <p className="text-[14px] text-[#3e4947] mt-1 leading-relaxed">
                    In case of urgent escalation, dial the Nursing Station at Ext. 402.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Floating Action Button (Desktop) */}
      <button
        className="hidden lg:flex fixed bottom-8 right-8 w-14 h-14 bg-[#006b5f] text-white rounded-full items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-40"
        aria-label="Add new record"
      >
        <Plus className="w-6 h-6" />
      </button>

    </div>
  );
};
