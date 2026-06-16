import { useState } from 'react';
import {
  Search,
  UserPlus,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Info,
  Calendar as CalendarIcon,
  Users,
  AlertTriangle,
  ArrowRight,
  UserSearch,
  Check
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';

// --- Types ---

export interface Patient {
  id: string;
  name: string;
  detail: string; // phone or ID/DOB
  avatarUrl?: string;
  hasInsurance?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  specialty: string;
  avatarUrl?: string;
  isAny?: boolean;
}

export interface Slot {
  id: string;
  time: string;
  status: 'available' | 'booked' | 'over_capacity';
  duration?: string;
  period: 'Morning' | 'Afternoon';
}

// --- Mock Data ---

const MOCK_PATIENTS: Patient[] = [
  {
    id: 'pt-1',
    name: 'Eleanor Shellstrop',
    detail: 'ID: #PT-90210 | DOB: 02/14/1982',
    avatarUrl: 'https://i.pravatar.cc/150?u=eleanor',
    hasInsurance: true,
  },
  {
    id: 'pt-2',
    name: 'Michael Realman',
    detail: 'ID: #PT-44512 | DOB: 11/22/1975',
  },
  {
    id: 'pt-3',
    name: 'Tahani Al-Jamil',
    detail: 'ID: #PT-11209 | DOB: 05/12/1988',
  },
];

const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'dr-1',
    name: 'Dr. Aris Varma',
    specialty: 'Cardiology',
    avatarUrl: 'https://i.pravatar.cc/150?u=aris',
  },
  {
    id: 'dr-2',
    name: 'Dr. Rajat Mohan',
    specialty: 'Neurology',
    avatarUrl: 'https://i.pravatar.cc/150?u=sarah',
  },
  {
    id: 'any',
    name: 'Any Provider',
    specialty: 'First Available',
    isAny: true,
  },
];

const MOCK_SLOTS: Slot[] = [
  { id: 's-1', time: '08:30 AM', status: 'booked', period: 'Morning' },
  { id: 's-2', time: '09:00 AM', status: 'booked', period: 'Morning' },
  { id: 's-3', time: '09:30 AM', status: 'booked', period: 'Morning' },
  { id: 's-4', time: '10:00 AM', status: 'booked', period: 'Morning' },
  { id: 's-5', time: '10:15 AM', status: 'over_capacity', period: 'Morning' },
  { id: 's-6', time: '10:30 AM', status: 'available', duration: '15m', period: 'Morning' },
  
  { id: 's-7', time: '01:30 PM', status: 'available', period: 'Afternoon' },
  { id: 's-8', time: '02:00 PM', status: 'available', period: 'Afternoon' },
  { id: 's-9', time: '02:30 PM', status: 'available', period: 'Afternoon' },
  { id: 's-10', time: '03:00 PM', status: 'available', period: 'Afternoon' },
  { id: 's-11', time: '03:30 PM', status: 'available', period: 'Afternoon' },
  { id: 's-12', time: '04:00 PM', status: 'available', period: 'Afternoon' },
];

const MOCK_DATES = [
  { day: 'Mon', date: '12', month: 'Oct', active: true },
  { day: 'Tue', date: '13', month: 'Oct', active: false },
  { day: 'Wed', date: '14', month: 'Oct', active: false },
  { day: 'Thu', date: '15', month: 'Oct', active: false },
];

export function BookOnBehalf() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>('pt-1');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>('dr-1');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>('s-7');
  const [notes, setNotes] = useState('');

  const selectedPatient = MOCK_PATIENTS.find(p => p.id === selectedPatientId);
  const selectedProvider = MOCK_PROVIDERS.find(p => p.id === selectedProviderId);
  const selectedSlot = MOCK_SLOTS.find(s => s.id === selectedSlotId);

  // --- Shared Rendering Components ---

  const renderSlot = (slot: Slot, _isMobile: boolean = false) => {
    const isSelected = selectedSlotId === slot.id;
    
    if (slot.status === 'booked') {
      return (
        <button
          key={slot.id}
          disabled
          className="relative group p-4 rounded-xl border border-outline-variant bg-surface-container-highest/50 cursor-not-allowed overflow-hidden w-full text-left"
        >
          <p className="font-label-bold text-label-bold text-outline line-through">{slot.time}</p>
          <p className="font-label-sm text-label-sm text-outline mt-1">Booked</p>
        </button>
      );
    }

    if (slot.status === 'over_capacity') {
      return (
        <button
          key={slot.id}
          onClick={() => setSelectedSlotId(slot.id)}
          className={`p-4 rounded-xl border w-full text-left transition-all active:scale-95 ${
            isSelected 
              ? 'border-status-warning bg-status-warning/20 ring-2 ring-status-warning/50' 
              : 'border-status-warning bg-status-warning/5 cursor-pointer hover:bg-status-warning/10'
          }`}
        >
          <div className="flex justify-between items-start">
            <p className={`font-label-bold text-label-bold ${isSelected ? 'text-status-warning' : ''}`}>{slot.time}</p>
            <AlertTriangle className="w-4 h-4 text-status-warning" />
          </div>
          <p className="font-label-sm text-label-sm text-status-warning mt-1">Over capacity</p>
        </button>
      );
    }

    return (
      <button
        key={slot.id}
        onClick={() => setSelectedSlotId(slot.id)}
        className={`p-4 rounded-xl transition-all group w-full text-left active:scale-95 ${
          isSelected
            ? 'border-2 border-primary bg-primary text-on-primary ring-4 ring-primary/10 shadow-md'
            : 'border border-outline-variant bg-surface-card hover:border-primary hover:text-primary cursor-pointer shadow-sm'
        }`}
      >
        <p className="font-label-bold text-label-bold">{slot.time}</p>
        <p className={`font-label-sm text-label-sm mt-1 ${
          isSelected ? 'opacity-80' : 'text-on-surface-variant group-hover:text-primary'
        }`}>
          {isSelected ? 'Selected' : (slot.duration ? `Duration: ${slot.duration}` : 'Available')}
        </p>
      </button>
    );
  };

  // --- Mobile Layout Views ---

  const renderMobileStep1 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Patient Search</h1>
      
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
        <Input 
          className="w-full h-12 pl-12 pr-4 bg-surface rounded-xl border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-body-base"
          placeholder="Search by name or mobile number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        <button 
          onClick={() => setStep(2)}
          className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary-container/10 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container group-hover:scale-110 transition-transform shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-label-bold text-label-bold">+ New Patient</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Create a new clinical record</p>
          </div>
        </button>

        <div className="space-y-3">
          <p className="font-label-bold text-label-bold text-outline px-1">Recent Searches</p>
          {MOCK_PATIENTS.map(patient => (
            <div 
              key={patient.id}
              onClick={() => {
                setSelectedPatientId(patient.id);
                setStep(2);
              }}
              className="flex items-center justify-between p-4 bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container active:scale-95 transition-transform cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 bg-surface-container-high text-on-surface-variant">
                  {patient.avatarUrl ? <AvatarImage src={patient.avatarUrl} /> : <AvatarFallback><UserSearch className="w-6 h-6" /></AvatarFallback>}
                </Avatar>
                <div>
                  <p className="font-label-bold text-label-bold">{patient.name}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{patient.detail}</p>
                </div>
              </div>
              <ChevronRight className="text-outline w-5 h-5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMobileStep2 = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setStep(1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Select Provider</h1>
      </div>

      <div className="mb-8 overflow-x-auto hide-scrollbar -mx-4 px-4 flex gap-4">
        {MOCK_PROVIDERS.filter(p => !p.isAny).map(provider => {
          const isSelected = selectedProviderId === provider.id;
          return (
            <div 
              key={provider.id}
              onClick={() => setSelectedProviderId(provider.id)}
              className={`flex-shrink-0 w-40 p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-primary-container border-2 border-primary text-on-primary-container' 
                  : 'bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container text-on-surface opacity-70 hover:opacity-100'
              }`}
            >
              <Avatar className={`w-16 h-16 mb-3 ${isSelected ? 'border-2 border-primary' : ''}`}>
                <AvatarImage src={provider.avatarUrl} className="object-cover" />
                <AvatarFallback>{provider.name.charAt(4)}</AvatarFallback>
              </Avatar>
              <p className="font-label-bold text-label-bold">{provider.name}</p>
              <p className={`font-label-sm text-label-sm ${isSelected ? 'opacity-80' : 'text-on-surface-variant'}`}>{provider.specialty}</p>
            </div>
          );
        })}
      </div>

      <p className="font-label-bold text-label-bold mb-4">Available Dates</p>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {MOCK_DATES.map((d, i) => (
          <div key={i} className={`flex flex-col items-center p-3 rounded-xl ${
            d.active 
              ? 'bg-primary text-on-primary' 
              : 'bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container'
          }`}>
            <span className={`font-label-sm text-label-sm ${d.active ? 'opacity-80' : 'text-outline'}`}>{d.day}</span>
            <span className="text-xl font-bold">{d.date}</span>
            <span className={`font-label-sm text-label-sm ${d.active ? '' : 'text-outline'}`}>{d.month}</span>
          </div>
        ))}
      </div>

      <Button 
        onClick={() => setStep(3)}
        className="w-full h-12 bg-primary text-on-primary rounded-full font-label-bold text-label-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
      >
        Next: Choose Time
      </Button>
    </div>
  );

  const renderMobileStep3 = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setStep(2)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">Confirm Slot</h1>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="font-label-bold text-label-bold">Monday, Oct 12</p>
        <div className="flex items-center gap-2 text-status-success">
          <span className="w-2 h-2 rounded-full bg-current"></span>
          <span className="font-label-sm text-label-sm">8 slots available</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MOCK_SLOTS.slice(0, 6).map(slot => renderSlot(slot, true))}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-surface-container-low border border-outline-variant">
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Booking Summary</p>
        <div className="space-y-1">
          <p className="font-body-base text-body-base"><strong>Patient:</strong> {selectedPatient?.name}</p>
          <p className="font-body-base text-body-base"><strong>Doctor:</strong> {selectedProvider?.name}</p>
        </div>
      </div>

      {/* Fixed Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white p-6 shadow-[0_-4px_20px_-2px_rgba(15,23,42,0.05)] rounded-t-3xl border-t border-surface-container z-50 max-w-[768px] mx-auto">
        <Button className="w-full h-12 bg-primary text-on-primary rounded-full font-label-bold text-label-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2">
          Book Appointment
          <CheckCircle2 className="w-5 h-5" />
        </Button>
        <p className="text-center mt-3 font-label-sm text-label-sm text-on-surface-variant">Booking on behalf of Staff Member</p>
      </div>
    </div>
  );

  return (
    <>
      {/* MOBILE LAYOUT */}
      <div className="md:hidden flex flex-col min-h-screen bg-surface-container-lowest max-w-[768px] mx-auto pb-8">
        
        {/* Mobile Stepper Header */}
        <div className="px-4 pt-8 pb-6 bg-surface-container-lowest sticky top-0 z-40">
          <div className="flex items-center justify-between">
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-bold text-label-bold transition-colors duration-300 ${
                step >= 1 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`font-label-sm text-label-sm ${step >= 1 ? 'text-primary' : 'text-on-surface-variant'}`}>Search</span>
            </div>
            
            <div className={`h-[2px] flex-grow mx-2 transition-colors duration-300 ${step >= 2 ? 'bg-primary' : 'bg-outline-variant'}`} />
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-bold text-label-bold transition-colors duration-300 ${
                step >= 2 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {step > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`font-label-sm text-label-sm ${step >= 2 ? 'text-primary' : 'text-on-surface-variant'}`}>Schedule</span>
            </div>
            
            <div className={`h-[2px] flex-grow mx-2 transition-colors duration-300 ${step >= 3 ? 'bg-primary' : 'bg-outline-variant'}`} />
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-bold text-label-bold transition-colors duration-300 ${
                step >= 3 ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                3
              </div>
              <span className={`font-label-sm text-label-sm ${step >= 3 ? 'text-primary' : 'text-on-surface-variant'}`}>Confirm</span>
            </div>
            
          </div>
        </div>

        <div className="flex-1 px-4">
          {step === 1 && renderMobileStep1()}
          {step === 2 && renderMobileStep2()}
          {step === 3 && renderMobileStep3()}
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
              <label className="font-label-bold text-label-bold text-on-surface-variant block mb-2" htmlFor="desktop-patient-search">
                Search patient by name or ID
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <Input 
                  id="desktop-patient-search"
                  className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 text-body-base"
                  placeholder="e.g. Eleanor Shellstrop or #PT-90210"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3 pr-2">
              {MOCK_PATIENTS.map(patient => {
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
                      {patient.avatarUrl ? <AvatarImage src={patient.avatarUrl} className="object-cover" /> : <AvatarFallback><UserSearch className="w-5 h-5 text-outline" /></AvatarFallback>}
                    </Avatar>
                    <div className="flex-1">
                      <p className={`font-label-bold text-label-bold ${isSelected ? 'text-on-primary-container' : 'text-on-surface'}`}>
                        {patient.name}
                      </p>
                      <p className={`font-label-sm text-label-sm ${isSelected ? 'text-on-primary-container opacity-80' : 'text-on-surface-variant'}`}>
                        {patient.detail}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="text-on-primary-container w-6 h-6 fill-current" />}
                  </div>
                );
              })}
            </div>

            {/* Contextual Meta Info (Active Insurance) */}
            {selectedPatient?.hasInsurance && (
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant mt-auto">
                <h3 className="font-label-bold text-label-bold text-primary mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" /> 
                  Active Insurance
                </h3>
                <p className="font-body-base text-body-base text-on-surface-variant">United Healthcare - PPO Elite</p>
                <div className="mt-3 flex gap-2">
                  <span className="px-2 py-1 bg-status-success/10 text-status-success font-label-sm text-[10px] rounded border border-status-success/20">VERIFIED</span>
                  <span className="px-2 py-1 bg-secondary-container/30 text-on-secondary-container font-label-sm text-[10px] rounded">REFERRAL ON FILE</span>
                </div>
              </div>
            )}
          </section>

          {/* Desktop Right Pane: Schedule & Slots */}
          <section className="flex-1 bg-background flex flex-col overflow-hidden relative">
            <div className="p-8 flex flex-col gap-8 overflow-y-auto flex-1 hide-scrollbar pb-32">
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-lg text-headline-lg text-primary">Appointment Schedule</h2>
                  <div className="flex items-center gap-2 bg-surface-card border border-outline-variant px-4 py-2 rounded-xl shadow-sm">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    <span className="font-label-bold text-label-bold">Oct 24, 2023</span>
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                  {MOCK_PROVIDERS.map(provider => {
                    const isSelected = selectedProviderId === provider.id;
                    return (
                      <button 
                        key={provider.id}
                        onClick={() => setSelectedProviderId(provider.id)}
                        className={`flex-shrink-0 flex items-center gap-3 p-3 rounded-xl min-w-[200px] transition-colors text-left ${
                          isSelected 
                            ? 'border-2 border-primary bg-primary/5' 
                            : 'border border-outline-variant bg-surface-card hover:bg-surface-container-high'
                        }`}
                      >
                        {provider.isAny ? (
                          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-outline" />
                          </div>
                        ) : (
                          <img src={provider.avatarUrl} alt={provider.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        )}
                        <div>
                          <p className={`font-label-bold text-label-bold ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                            {provider.name}
                          </p>
                          <p className={`font-label-sm text-label-sm ${isSelected ? 'text-primary' : 'text-outline'}`}>
                            {provider.specialty}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* High Volume Warning (Mocked logic for Dr. Aris) */}
              {selectedProviderId === 'dr-1' && (
                <div className="p-4 bg-status-warning/10 border border-status-warning/30 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-label-bold text-label-bold text-status-warning">High Volume Warning</p>
                    <p className="font-body-base text-body-base text-on-surface-variant mt-1">
                      Dr. Varma is currently over capacity for today. Only emergency referrals or administrative overrides are permitted for the morning blocks.
                    </p>
                  </div>
                </div>
              )}

              {/* Slots Grid */}
              <div className="space-y-8">
                <div>
                  <h3 className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-4">Morning Sessions</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {MOCK_SLOTS.filter(s => s.period === 'Morning').map(slot => renderSlot(slot))}
                  </div>
                </div>

                <div>
                  <h3 className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-4">Afternoon Sessions</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {MOCK_SLOTS.filter(s => s.period === 'Afternoon').map(slot => renderSlot(slot))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="font-label-bold text-label-bold text-on-surface-variant block mb-2" htmlFor="booking-notes">
                  Internal Admin Notes
                </label>
                <textarea 
                  id="booking-notes"
                  className="w-full p-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body-base text-body-base outline-none resize-none"
                  placeholder="Add any special requirements or referral details..." 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

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
                <p className="font-headline-md text-headline-md text-on-surface">Oct 24, 2023 at {selectedSlot?.time || '...'}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  Patient: {selectedPatient?.name || '...'} | {selectedProvider?.name || '...'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" className="h-12 px-8 rounded-full border-outline text-on-surface-variant font-label-bold hover:bg-surface-container-high transition-colors">
              Cancel
            </Button>
            <Button className="h-12 px-10 rounded-full bg-primary text-on-primary font-label-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2">
              Confirm Appointment
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </footer>

      </div>
    </>
  );
}

export default BookOnBehalf;