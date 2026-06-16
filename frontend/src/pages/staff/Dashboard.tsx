import { useState } from 'react';
import {
  UserCheck,
  Clock,
  CalendarOff,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Timer,
  Stethoscope
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';

// --- Types & Mock Data ---

export interface Appointment {
  id: string;
  token: string;
  patientName: string;
  patientInitials: string;
  mobile: string;
  slotTime: string;
  status: 'Checked-in' | 'Waiting' | 'Completed' | 'Scheduled' | 'Cancelled';
}

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    token: '#CKL-902',
    patientName: 'Arthur Wellington',
    patientInitials: 'AW',
    mobile: '+1 (555) 012-3456',
    slotTime: '09:30 AM',
    status: 'Checked-in',
  },
  {
    id: '2',
    token: '#CKL-903',
    patientName: 'Lucia Martinez',
    patientInitials: 'LM',
    mobile: '+1 (555) 024-6810',
    slotTime: '10:00 AM',
    status: 'Waiting',
  },
  {
    id: '3',
    token: '#CKL-904',
    patientName: 'Samuel Thompson',
    patientInitials: 'ST',
    mobile: '+1 (555) 987-6543',
    slotTime: '10:15 AM',
    status: 'Checked-in',
  },
  {
    id: '4',
    token: '#CKL-899',
    patientName: 'Brian Edwards',
    patientInitials: 'BE',
    mobile: '+1 (555) 443-2211',
    slotTime: '09:00 AM',
    status: 'Cancelled',
  },
  {
    id: '5',
    token: '#CKL-905',
    patientName: 'Nina Chen',
    patientInitials: 'NC',
    mobile: '+1 (555) 111-0000',
    slotTime: '10:45 AM',
    status: 'Waiting',
  },
];

const MOCK_PHYSICIANS = [
  'Dr. Sarah Jenkins',
  'Dr. Michael Chen',
  'Dr. Elena Rodriguez'
];

// --- Helper Components ---

const StatusBadge = ({ status, isMobile = false }: { status: Appointment['status'], isMobile?: boolean }) => {
  const baseClasses = isMobile 
    ? "px-2 py-0.5 rounded-lg font-label-sm text-[10px] uppercase tracking-tight"
    : "inline-flex items-center px-3 py-1 rounded-full text-label-sm font-label-bold";

  switch (status) {
    case 'Checked-in':
      return <span className={`${baseClasses} bg-secondary-container text-on-secondary-container`}>{status}</span>;
    case 'Waiting':
      return <span className={`${baseClasses} bg-tertiary-fixed text-on-tertiary-fixed-variant`}>{status}</span>;
    case 'Cancelled':
      return <span className={`${baseClasses} bg-error-container text-error`}>{status}</span>;
    case 'Completed':
      return <span className={`${baseClasses} bg-surface-container-highest text-on-surface-variant`}>{status}</span>;
    case 'Scheduled':
      return <span className={`${baseClasses} bg-tertiary-fixed text-on-tertiary-fixed-variant`}>{status}</span>;
    default:
      return <span className={baseClasses}>{status}</span>;
  }
};

// --- Main Component ---

export function Dashboard() {
  const [selectedPhysician, setSelectedPhysician] = useState(MOCK_PHYSICIANS[0]);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans pb-12">
      <main className="max-w-[1200px] mx-auto px-4 md:px-10 py-8 md:py-12 flex flex-col gap-6 md:gap-8">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          
          {/* Mobile Heading */}
          <div className="md:hidden flex justify-between items-center">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">Staff Portal</h1>
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-label-bold">
              SJ
            </div>
          </div>

          {/* Desktop Heading */}
          <div className="hidden md:block space-y-1">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Clinic Overview</h1>
            <p className="font-body-base text-on-surface-variant">Real-time patient flow and appointment management.</p>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            
            {/* Mobile Physician Selector */}
            <div className="md:hidden relative mt-2">
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Assigned Physician</label>
              <div className="relative group">
                <select 
                  className="appearance-none w-full bg-surface-card border border-outline-variant h-12 px-4 pr-10 rounded-xl font-body-base focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  value={selectedPhysician}
                  onChange={(e) => setSelectedPhysician(e.target.value)}
                >
                  {MOCK_PHYSICIANS.map(doc => <option key={doc} value={doc}>{doc}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Desktop Physician Selector */}
            <div className="hidden md:block relative group min-w-[240px]">
              <label className="block font-label-bold text-label-bold text-on-surface-variant mb-1 ml-1">Assigned Physician</label>
              <div className="h-12 flex items-center justify-between px-4 bg-surface-card border border-outline-variant rounded-xl cursor-pointer hover:border-primary transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  <span className="font-body-base">{selectedPhysician}</span>
                </div>
                <ChevronDown className="w-5 h-5 text-outline" />
              </div>
            </div>

            {/* Action Button */}
            <Button className="h-12 px-6 bg-primary text-on-primary rounded-full font-label-bold text-label-bold flex items-center gap-2 hover:bg-primary-container hover:text-on-primary-container transition-all active:scale-95 shadow-md md:shadow-none w-full md:w-auto mt-2 md:mt-0">
              <UserPlus className="w-5 h-5" />
              + Book for a Patient
            </Button>
          </div>
        </header>

        {/* --- STATS SECTION --- */}
        
        {/* Mobile Stats */}
        <section className="md:hidden grid grid-cols-3 gap-3">
          <Card className="bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container flex flex-col items-center justify-center text-center p-4">
            <span className="text-primary font-headline-md text-headline-md">12</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Checked-in</span>
          </Card>
          <Card className="bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container flex flex-col items-center justify-center text-center p-4">
            <span className="text-status-warning font-headline-md text-headline-md">04</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Waiting</span>
          </Card>
          <Card className="bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container flex flex-col items-center justify-center text-center p-4">
            <span className="text-on-surface-variant font-headline-md text-headline-md">08</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Remaining</span>
          </Card>
        </section>

        {/* Desktop Stats */}
        <section className="hidden md:grid grid-cols-3 gap-6">
          <Card className="bg-surface-card p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container-high flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="font-label-bold text-label-bold text-on-surface-variant block mb-1">Checked-in</span>
              <span className="font-headline-lg text-headline-lg">18</span>
            </div>
          </Card>
          <Card className="bg-surface-card p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container-high flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant">
              <Clock className="w-7 h-7 text-tertiary-container" />
            </div>
            <div>
              <span className="font-label-bold text-label-bold text-on-surface-variant block mb-1">Waiting</span>
              <span className="font-headline-lg text-headline-lg">04</span>
            </div>
          </Card>
          <Card className="bg-surface-card p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container-high flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center text-error">
              <CalendarOff className="w-7 h-7" />
            </div>
            <div>
              <span className="font-label-bold text-label-bold text-on-surface-variant block mb-1">Cancelled</span>
              <span className="font-headline-lg text-headline-lg">02</span>
            </div>
          </Card>
        </section>


        {/* --- APPOINTMENTS SECTION --- */}

        {/* Mobile Appointments List */}
        <section className="md:hidden flex flex-col gap-4">
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-label-bold text-label-bold text-on-surface uppercase tracking-wider">Today's Appointments</h2>
            <span className="text-primary font-label-sm text-label-sm cursor-pointer hover:underline">View All</span>
          </div>

          <div className="flex flex-col gap-4">
            {MOCK_APPOINTMENTS.map((apt, idx) => (
              <Card key={apt.id} className={`bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-surface-container-low flex flex-col group active:bg-surface-container-low transition-colors duration-200 ${apt.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="bg-surface-container-high w-12 h-12 rounded-xl flex items-center justify-center text-on-surface-variant">
                        <span className="font-label-bold text-label-bold">#{apt.token.split('-')[1]}</span>
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-label-bold text-label-bold text-on-surface">{apt.patientName}</h3>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">{apt.mobile}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`font-label-bold text-label-bold ${apt.status === 'Cancelled' ? 'line-through text-on-surface-variant' : 'text-primary'}`}>
                        {apt.slotTime}
                      </span>
                      <div className="mt-1">
                        <StatusBadge status={apt.status} isMobile />
                      </div>
                    </div>
                  </div>

                  {/* Actions / Avatars inside card */}
                  {apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                    <div className="flex justify-between items-center pt-2 border-t border-surface-container">
                      <div className="flex -space-x-2">
                        {idx % 2 === 0 ? (
                           <>
                            <div className="w-6 h-6 rounded-full bg-primary-container border-2 border-surface-card"></div>
                            <div className="w-6 h-6 rounded-full bg-secondary-container border-2 border-surface-card"></div>
                           </>
                        ) : (
                           <div className="w-6 h-6 rounded-full bg-primary-container border-2 border-surface-card"></div>
                        )}
                      </div>
                      <button className="text-primary font-label-sm text-label-sm flex items-center gap-1 hover:underline">
                        Check-in <ChevronRight className="w-[18px] h-[18px]" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Desktop Appointments Table */}
        <section className="hidden md:block bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container-high overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-high flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md">Active Appointments</h3>
            <div className="flex items-center gap-2 text-primary font-label-bold text-label-bold cursor-pointer hover:underline">
              <Filter className="w-5 h-5" />
              Refine List
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container-high">
                  <th className="px-6 py-4 font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Token</th>
                  <th className="px-6 py-4 font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Patient Name</th>
                  <th className="px-6 py-4 font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Mobile</th>
                  <th className="px-6 py-4 font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Slot Time</th>
                  <th className="px-6 py-4 font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {MOCK_APPOINTMENTS.map((apt) => (
                  <tr key={apt.id} className={`hover:bg-surface-container-lowest transition-colors group cursor-pointer ${apt.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-5 font-label-bold text-primary whitespace-nowrap">{apt.token}</td>
                    <td className="px-6 py-5 flex items-center gap-3 whitespace-nowrap">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-bold text-on-surface-variant shrink-0">
                        {apt.patientInitials}
                      </div>
                      <span className="font-body-base font-medium">{apt.patientName}</span>
                    </td>
                    <td className="px-6 py-5 font-body-base text-on-surface-variant whitespace-nowrap">{apt.mobile}</td>
                    <td className={`px-6 py-5 font-body-base whitespace-nowrap ${apt.status === 'Cancelled' ? 'line-through' : ''}`}>{apt.slotTime}</td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <button className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between border-t border-surface-container-high">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Showing 5 of 24 patients</span>
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-white transition-colors disabled:opacity-30 bg-surface-card" disabled>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-white transition-colors bg-surface-card">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        {/* --- SHIFT NOTE (MOBILE ONLY ASYMMETRIC CARD) --- */}
        <section className="md:hidden bg-primary-container text-on-primary-container p-5 rounded-3xl relative overflow-hidden mt-2 shadow-md">
          <div className="relative z-10">
            <h4 className="font-label-bold text-label-bold mb-1 opacity-80">Shift Note</h4>
            <p className="font-body-base text-body-base leading-relaxed">Remember to update the patient tags for the afternoon immunization clinic.</p>
            <div className="mt-4 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              <span className="font-label-sm text-label-sm">Due in 2 hours</span>
            </div>
          </div>
          {/* Aesthetic abstract shapes */}
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-on-primary-container opacity-10 rounded-full pointer-events-none"></div>
          <div className="absolute right-8 top-2 w-12 h-12 bg-on-primary-container opacity-5 rounded-full pointer-events-none"></div>
        </section>

      </main>
      
      {/* Background decoration for desktop */}
      <div className="hidden md:block fixed top-0 right-0 -z-10 w-1/3 h-1/2 opacity-20 pointer-events-none overflow-hidden bg-gradient-to-bl from-primary/5 to-transparent"></div>
    </div>
  );
}

export default Dashboard;