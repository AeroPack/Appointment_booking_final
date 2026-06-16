import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { StatusPill } from '@/core/components/common/StatusPill';
import { useGetMyAppointmentsQuery } from '@/features/appointments/appointmentsApi';
import { useGetDependentsQuery } from '@/features/users/usersApi';

// ==========================================
// MY APPOINTMENTS COMPONENT
// ==========================================

export function MyAppointments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [activePatient, setActivePatient] = useState('All');

  const statusFilter = activeTab === 'upcoming' ? 'booked' : 'finished,cancelled,no_show';
  const { data: appointments, isLoading } = useGetMyAppointmentsQuery({ status: statusFilter });
  const { data: dependents } = useGetDependentsQuery();

  const allPatients = [
    { id: 'Me', name: 'Me' },
    ...(dependents?.map((d) => ({ id: d.id, name: d.name })) ?? []),
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#0F172A] font-sans">

      <main className="max-w-7xl mx-auto px-4 md:px-10 py-8 md:py-12">
        {/* --- PAGE HEADER & TABS --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="flex flex-col gap-4 md:gap-2">
            <h1 className="text-2xl md:text-[32px] font-bold text-[#0F172A] leading-tight">My Appointments</h1>
            <p className="hidden md:block text-slate-500 text-lg">Manage your upcoming and past healthcare consultations.</p>
            
            {/* Mobile Tabs */}
            <div className="md:hidden bg-slate-100 p-1 rounded-xl flex w-full">
              <button 
                onClick={() => setActiveTab('upcoming')} 
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-white text-[#005c55] shadow-sm' : 'text-slate-500'}`}
              >
                Upcoming
              </button>
              <button 
                onClick={() => setActiveTab('past')} 
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'past' ? 'bg-white text-[#005c55] shadow-sm' : 'text-slate-500'}`}
              >
                Past
              </button>
            </div>
          </div>

          {/* Desktop Tabs & Filters */}
          <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button 
                onClick={() => setActiveTab('upcoming')} 
                className={`px-8 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'upcoming' ? 'bg-white text-[#005c55] shadow-sm' : 'text-slate-500 hover:text-[#005c55]'}`}
              >
                Upcoming
              </button>
              <button 
                onClick={() => setActiveTab('past')} 
                className={`px-8 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'past' ? 'bg-white text-[#005c55] shadow-sm' : 'text-slate-500 hover:text-[#005c55]'}`}
              >
                Past
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patient:</span>
              <div className="flex gap-2">
                {allPatients.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => setActivePatient(p.name)} 
                    className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${activePatient === p.name ? 'bg-[#005c55] text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Patient Filters */}
          <div className="md:hidden flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            {['All', ...allPatients.map((p) => p.name)].map((name) => (
              <button 
                key={name} 
                onClick={() => setActivePatient(name)} 
                className={`flex-shrink-0 px-5 h-12 flex items-center justify-center rounded-full font-bold text-sm transition-colors ${activePatient === name ? 'bg-[#005c55] text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* --- CARDS GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading && <div className="col-span-full text-center py-8 text-slate-500">Loading appointments...</div>}

          {!isLoading && (!appointments || appointments.length === 0) && (
            <div className="col-span-full text-center py-8 text-slate-500">
              No {activeTab} appointments found.
            </div>
          )}

          {appointments?.map((appt) => (
            <Card key={appt.id} className="rounded-xl border border-slate-200 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] overflow-hidden transition-transform hover:-translate-y-1 group">
              <CardContent className="p-5 md:p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-[#0f766e]/10 flex items-center justify-center text-[#005c55] overflow-hidden shrink-0">
                      <Stethoscope className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-[#0F172A]">{appt.doctor_name}</h3>
                      <p className="text-slate-500 text-sm md:text-base">{appt.patient_name}</p>
                    </div>
                  </div>
                  <StatusPill status={appt.appointment_status} />
                </div>

                <div className="grid grid-cols-2 gap-y-4 py-4 md:py-2 border-y border-slate-100 md:border-none">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[#005c55]" />
                    <div>
                      <p className="hidden md:block text-xs text-slate-500 uppercase tracking-wider mb-0.5">Date</p>
                      <p className="font-bold text-[#0F172A] text-sm md:text-base">
                        {new Date(appt.scheduled_start).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-[#005c55]" />
                    <div>
                      <p className="hidden md:block text-xs text-slate-500 uppercase tracking-wider mb-0.5">Time</p>
                      <p className="font-bold text-[#0F172A] text-sm md:text-base">
                        {new Date(appt.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 col-span-2 md:col-span-1">
                    <MapPin className="w-5 h-5 text-[#005c55]" />
                    <div>
                      <p className="hidden md:block text-xs text-slate-500 uppercase tracking-wider mb-0.5">Venue</p>
                      <p className="font-bold text-[#0F172A] text-sm md:text-base">{appt.venue_name ?? 'N/A'}</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-[#005c55]" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Token</p>
                      <p className="font-bold text-[#0F172A] text-base">{appt.token_number ? `#${appt.token_number}` : '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center md:pt-4 md:border-t border-slate-100">
                  <div className="md:hidden flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-0.5">Token Number</span>
                    <span className="text-xl font-bold text-[#005c55]">{appt.token_number ? `#${appt.token_number}` : '—'}</span>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <Button variant="outline" className="flex-1 md:flex-none border-[#005c55] text-[#005c55] hover:bg-[#005c55]/5 rounded-full md:rounded-lg font-bold h-12 md:h-10 px-6">
                      Reschedule
                    </Button>
                    <Button
                      onClick={() => navigate(`/patient/appointment/${appt.id}`)}
                      className="hidden md:flex flex-1 md:flex-none bg-[#005c55] text-white hover:bg-[#004a44] rounded-lg font-bold h-10 px-6"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:flex bg-slate-50 border-t border-slate-200 mt-12 w-full">
        <div className="flex justify-between items-center w-full px-10 py-8 max-w-7xl mx-auto">
          <span className="font-bold text-slate-600">Rajat Mohan Hospital Clinic</span>
          <div className="flex gap-6">
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-[#005c55] transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-[#005c55] transition-colors">Terms of Service</a>
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-[#005c55] transition-colors">Contact Support</a>
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-[#005c55] transition-colors">Accessibility</a>
          </div>
          <p className="text-sm font-medium text-slate-400">© 2024 Rajat Mohan Hospital Clinic. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
