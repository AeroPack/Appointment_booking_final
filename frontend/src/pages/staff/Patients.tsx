import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  SortDesc, 
  X, 
  Plus, 
  Trash2, 
  ChevronRight, 
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Avatar, AvatarFallback } from '@/core/components/ui/avatar';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';

// --- Interfaces & Mock Data ---

interface Tag {
  id: string;
  label: string;
  colorClass: string;
  dotColor: string;
}

interface Patient {
  id: string;
  name: string;
  patientId: string;
  email: string;
  phone: string;
  lastVisit: string;
  dob: string;
  bloodType: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
  desktopTags: Tag[];
  mobileTags: Tag[];
}

const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    patientId: 'PJ-8821',
    email: 's.jenkins@email.com',
    phone: '+1 (555) 012-3456',
    lastVisit: '2 hours ago',
    dob: 'May 14, 1982',
    bloodType: 'O Negative',
    initials: 'SJ',
    avatarBg: 'bg-[#0f766e]',
    avatarText: 'text-white',
    desktopTags: [
      { id: 't1', label: 'High Priority', colorClass: 'bg-[#ffdad6] text-[#93000a]', dotColor: 'bg-[#ba1a1a]' },
      { id: 't2', label: 'Cardiology', colorClass: 'bg-[#6df5e1] text-[#006f64]', dotColor: 'bg-[#006b5f]' }
    ],
    mobileTags: [
      { id: 'mt1', label: 'VIP', colorClass: 'bg-[#ffdbce] text-[#72361b]', dotColor: 'bg-[#9c573a]' },
      { id: 'mt2', label: 'Chronic', colorClass: 'bg-[#6df5e1] text-[#006f64]', dotColor: 'bg-[#006b5f]' }
    ]
  },
  {
    id: '2',
    name: 'Marcus Thorne',
    patientId: 'PJ-1204',
    email: 'm.thorne@provider.net',
    phone: '+1 (555) 987-6543',
    lastVisit: 'Oct 12, 2023',
    dob: 'Aug 22, 1975',
    bloodType: 'A Positive',
    initials: 'MT',
    avatarBg: 'bg-[#e0e3e5]',
    avatarText: 'text-[#191c1e]',
    desktopTags: [
      { id: 't3', label: 'General', colorClass: 'bg-[#e6e8ea] text-[#3e4947]', dotColor: 'bg-[#6e7977]' },
      { id: 't4', label: 'Chronic Care', colorClass: 'bg-[#9c573a] text-[#ffe5db]', dotColor: 'bg-[#7f4025]' }
    ],
    mobileTags: [
      { id: 'mt3', label: 'New', colorClass: 'bg-[#9cf2e8] text-[#00504a]', dotColor: 'bg-[#005c55]' }
    ]
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    patientId: 'PJ-5532',
    email: 'elena.r@healthcare.org',
    phone: '+1 (555) 246-8135',
    lastVisit: 'Yesterday',
    dob: 'Nov 05, 1990',
    bloodType: 'B Negative',
    initials: 'ER',
    avatarBg: 'bg-[#71f8e4]',
    avatarText: 'text-[#00201c]',
    desktopTags: [
      { id: 't5', label: 'Recovery', colorClass: 'bg-[#0f766e] text-[#a3faef]', dotColor: 'bg-[#a3faef]' },
      { id: 't6', label: 'Post-Op', colorClass: 'bg-[#e0e3e5] text-[#3e4947]', dotColor: 'bg-[#6e7977]' }
    ],
    mobileTags: [
      { id: 'mt2', label: 'Chronic', colorClass: 'bg-[#6df5e1] text-[#006f64]', dotColor: 'bg-[#006b5f]' }
    ]
  },
  {
    id: '4',
    name: 'Julian Voss',
    patientId: 'PJ-0941',
    email: 'jvoss.contact@mail.com',
    phone: '+1 (555) 369-1472',
    lastVisit: '3 days ago',
    dob: 'Jan 18, 1988',
    bloodType: 'AB Positive',
    initials: 'JV',
    avatarBg: 'bg-[#e0e3e5]',
    avatarText: 'text-[#3e4947]',
    desktopTags: [
      { id: 't7', label: 'Follow-up', colorClass: 'bg-[#ffdbce] text-[#72361b]', dotColor: 'bg-[#9c573a]' }
    ],
    mobileTags: [
      { id: 'mt1', label: 'VIP', colorClass: 'bg-[#ffdbce] text-[#72361b]', dotColor: 'bg-[#9c573a]' }
    ]
  }
];

const mobileFilterChips = ['All Patients', 'New', 'VIP', 'Chronic'];

// --- Main Component ---

export function Patients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Patients');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(mockPatients[0] ?? null);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Manage body scroll locking for mobile sheet
  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileSheetOpen]);

  const handleRowClick = (patient: Patient) => {
    setSelectedPatient(patient);
    // On mobile, opening a row triggers the bottom sheet.
    // On desktop, it updates the right panel.
    if (window.innerWidth < 768) {
      setIsMobileSheetOpen(true);
    }
  };

  const closeMobileSheet = () => {
    setIsMobileSheetOpen(false);
  };

  return (
    <div className="min-h-screen md:h-screen bg-[#f7f9fb] font-body-base text-[#191c1e] flex flex-col md:flex-row overflow-hidden antialiased">
      
      {/* ========================================== */}
      {/* MOBILE VIEW                                */}
      {/* ========================================== */}
      <div className="md:hidden flex-1 flex flex-col w-full h-full overflow-hidden">
        
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          {/* Search Bar */}
          <div className="sticky top-0 z-30 pt-2 mb-6 bg-[#f7f9fb]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e7977]" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients by name or ID"
                className="w-full h-12 pl-12 pr-4 bg-white border-0 shadow-sm rounded-xl text-[16px] text-[#191c1e] placeholder:text-[#6e7977] focus-visible:ring-2 focus-visible:ring-[#005c55]"
              />
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mb-6 -mx-4 px-4 snap-x">
            {mobileFilterChips.map(chip => (
              <button
                key={chip}
                onClick={() => setActiveFilter(chip)}
                className={`snap-start flex-shrink-0 px-5 py-2.5 rounded-full font-semibold text-[14px] transition-all active:scale-95 ${
                  activeFilter === chip 
                    ? 'bg-[#005c55] text-white shadow-sm' 
                    : 'bg-[#e6e8ea] text-[#3e4947] hover:bg-[#e0e3e5]'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Mobile Patient List */}
          <div className="space-y-4">
            {mockPatients.map(patient => (
              <Card 
                key={patient.id} 
                onClick={() => handleRowClick(patient)}
                className="rounded-xl border-transparent shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] active:bg-[#f2f4f6] transition-colors cursor-pointer"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-[20px] font-semibold text-[#191c1e] leading-tight">{patient.name}</h3>
                      <p className="text-[12px] font-medium text-[#6e7977] mt-0.5">{patient.phone}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {patient.mobileTags.map(tag => (
                        <Badge key={tag.id} className={`font-semibold text-[12px] px-2 py-1 rounded-lg border-0 ${tag.colorClass}`}>
                          {tag.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#bdc9c6]/30">
                    <span className="text-[12px] font-medium text-[#6e7977]">Last Visit: {patient.lastVisit}</span>
                    <ChevronRight className="w-5 h-5 text-[#6e7977]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Mobile Bottom Sheet Overlay & Content */}
        {isMobileSheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
              onClick={closeMobileSheet} 
            />
            <div className="relative bg-[#f7f9fb] w-full rounded-t-[28px] shadow-2xl pb-8 animate-in slide-in-from-bottom-full duration-300 flex flex-col max-h-[90vh]">
              
              {/* Drag Handle */}
              <div className="flex justify-center pt-4 pb-2 shrink-0">
                <div className="w-12 h-1.5 bg-[#bdc9c6] rounded-full" />
              </div>
              
              <div className="px-5 overflow-y-auto shrink-0 pb-safe">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[24px] font-bold text-[#191c1e]">{selectedPatient?.name}</h2>
                  <button 
                    onClick={closeMobileSheet}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#e6e8ea] text-[#3e4947] active:scale-95 transition-transform"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-[14px] font-semibold text-[#6e7977] mb-4">Manage Tags</p>
                
                {/* Simulated Interactive Tags List (Matches Mobile Screenshot) */}
                <div className="grid grid-cols-1 gap-3 mb-8">
                  {[
                    { label: 'New Patient', dot: 'bg-[#4fdbc8]', active: false },
                    { label: 'VIP Status', dot: 'bg-[#ffb598]', active: true },
                    { label: 'Chronic Care', dot: 'bg-[#4fdbc8]', active: false },
                    { label: 'High Risk', dot: 'bg-[#F59E0B]/60', active: false },
                  ].map((tag, idx) => (
                    <button 
                      key={idx} 
                      className={`flex items-center justify-between p-4 bg-[#f2f4f6] rounded-xl border transition-all active:scale-[0.98] ${tag.active ? 'border-[#80d5cb]' : 'border-transparent'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${tag.dot}`} />
                        <span className="text-[16px] text-[#191c1e]">{tag.label}</span>
                      </div>
                      {tag.active && <CheckCircle2 className="w-6 h-6 text-[#005c55]" />}
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={closeMobileSheet}
                  className="w-full h-[52px] rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold text-[16px] shadow-md active:scale-95 transition-all"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* DESKTOP VIEW                               */}
      {/* ========================================== */}
      <div className="hidden md:flex flex-1 w-full h-full overflow-hidden">
        
        {/* Left Pane: Master List */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#bdc9c6] bg-[#f7f9fb]">
          
          <header className="p-6 lg:px-8 bg-white shadow-sm space-y-5 z-10 shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-[32px] font-bold text-[#005c55] tracking-tight">Patient Directory</h1>
              <Button className="h-10 px-6 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full font-semibold shadow-sm flex items-center gap-2 active:scale-95 transition-all">
                <UserPlus className="w-5 h-5" />
                New Patient
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e7977]" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID or tag..."
                  className="w-full h-12 pl-12 pr-4 bg-[#f2f4f6] border-0 focus-visible:ring-2 focus-visible:ring-[#005c55] rounded-xl text-[16px]"
                />
              </div>
              <Button variant="outline" className="h-12 px-5 border-[#bdc9c6] text-[#3e4947] hover:bg-[#f2f4f6] rounded-xl font-semibold gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </Button>
              <Button variant="outline" className="h-12 px-5 border-[#bdc9c6] text-[#3e4947] hover:bg-[#f2f4f6] rounded-xl font-semibold gap-2">
                <SortDesc className="w-5 h-5" />
                Latest First
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#f2f4f6] z-10 shadow-sm border-b border-[#bdc9c6]">
                <tr className="text-left">
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Patient</th>
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Contact</th>
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Last Visit</th>
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bdc9c6]/50">
                {mockPatients.map(patient => (
                  <tr 
                    key={patient.id}
                    onClick={() => handleRowClick(patient)}
                    className={`cursor-pointer transition-colors group ${
                      selectedPatient?.id === patient.id 
                        ? 'bg-[#005c55]/10 border-l-4 border-[#005c55]' 
                        : 'hover:bg-[#005c55]/5 border-l-4 border-transparent'
                    }`}
                  >
                    <td className="px-6 lg:px-8 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className={`w-12 h-12 rounded-full ${patient.avatarBg} border-0 flex items-center justify-center shrink-0`}>
                          <AvatarFallback className={`${patient.avatarText} font-bold text-[16px] bg-transparent`}>
                            {patient.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-[16px] text-[#191c1e]">{patient.name}</div>
                          <div className="font-medium text-[12px] text-[#6e7977]">ID: {patient.patientId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 lg:px-8 py-4 text-[16px] text-[#3e4947]">{patient.email}</td>
                    <td className="px-6 lg:px-8 py-4 text-[16px] text-[#3e4947]">{patient.lastVisit}</td>
                    <td className="px-6 lg:px-8 py-4">
                      <div className="flex flex-wrap gap-2">
                        {patient.desktopTags.map(tag => (
                          <Badge key={tag.id} className={`font-semibold text-[12px] px-2 py-1 rounded-lg border-0 ${tag.colorClass}`}>
                            {tag.label}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane: Detail Aside */}
        {selectedPatient && (
          <aside className="w-96 bg-white border-l border-[#bdc9c6] shadow-2xl flex flex-col shrink-0 z-20 transition-all duration-300">
            <div className="p-6 border-b border-[#e0e3e5] flex items-center justify-between shrink-0 bg-white">
              <h2 className="text-[20px] font-semibold text-[#191c1e]">Patient Details</h2>
              <button 
                onClick={() => setSelectedPatient(null)}
                className="p-2 hover:bg-[#f2f4f6] rounded-full transition-colors text-[#6e7977]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#f7f9fb]">
              
              {/* Header Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className={`w-16 h-16 rounded-2xl ${selectedPatient.avatarBg} border-0 flex items-center justify-center shrink-0`}>
                    <AvatarFallback className={`${selectedPatient.avatarText} font-bold text-[24px] bg-transparent`}>
                      {selectedPatient.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#191c1e]">{selectedPatient.name}</h3>
                    <p className="text-[12px] font-medium text-[#6e7977]">Patient ID: {selectedPatient.patientId}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#eceef0] rounded-xl">
                    <div className="text-[12px] font-medium text-[#6e7977] mb-1">DOB</div>
                    <div className="text-[14px] font-semibold text-[#191c1e]">{selectedPatient.dob}</div>
                  </div>
                  <div className="p-4 bg-[#eceef0] rounded-xl">
                    <div className="text-[12px] font-medium text-[#6e7977] mb-1">Blood Type</div>
                    <div className="text-[14px] font-semibold text-[#191c1e]">{selectedPatient.bloodType}</div>
                  </div>
                </div>
              </div>

              {/* Clinical Tags */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-bold text-[#3e4947] uppercase tracking-wider">Clinical Tags</h4>
                  <button className="text-[#005c55] text-[12px] font-semibold hover:underline">Manage Schema</button>
                </div>
                
                <div className="relative">
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e7977]" />
                  <Input 
                    placeholder="Add a new tag..." 
                    className="w-full h-10 pl-10 pr-4 bg-[#eceef0] border-0 focus-visible:ring-1 focus-visible:ring-[#005c55] rounded-lg text-[14px] font-semibold"
                  />
                </div>
                
                <div className="space-y-3">
                  {/* Rendering the active desktop tags as editable rows */}
                  {selectedPatient.desktopTags.map(tag => (
                    <div key={tag.id} className="p-3 bg-white border border-[#e0e3e5] rounded-xl flex items-center justify-between group transition-colors hover:border-[#bdc9c6]">
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${tag.dotColor}`} />
                        <span className="text-[14px] font-semibold text-[#191c1e]">{tag.label}</span>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[#ffdad6] text-[#6e7977] hover:text-[#DC2626] rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Default tag for the design presentation if array is small */}
                  {selectedPatient.desktopTags.length < 3 && (
                    <div className="p-3 bg-white border border-[#e0e3e5] rounded-xl flex items-center justify-between group transition-colors hover:border-[#bdc9c6]">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#7f4025]" />
                        <span className="text-[14px] font-semibold text-[#191c1e]">Critical Care</span>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[#ffdad6] text-[#6e7977] hover:text-[#DC2626] rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Tags */}
              <div className="space-y-3">
                <h4 className="text-[12px] font-bold text-[#3e4947] uppercase tracking-wider">Suggested Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {['Outpatient', 'Diabetes', 'Billing Issue', 'Pediatric'].map(suggestion => (
                    <button 
                      key={suggestion}
                      className="px-3 py-1.5 border border-[#bdc9c6] rounded-lg text-[12px] font-semibold text-[#3e4947] hover:bg-white hover:border-[#005c55] hover:text-[#005c55] transition-all bg-transparent"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

            </div>
            
            {/* Footer Actions */}
            <div className="p-6 bg-white border-t border-[#e0e3e5] space-y-3 shrink-0">
              <Button className="w-full h-12 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-xl font-semibold text-[14px] shadow-sm active:scale-[0.98] transition-all">
                Save Changes
              </Button>
              <Button variant="outline" className="w-full h-12 border-[#bdc9c6] text-[#3e4947] bg-[#f7f9fb] hover:bg-[#eceef0] rounded-xl font-semibold text-[14px] transition-colors">
                View Full Profile
              </Button>
            </div>
          </aside>
        )}
      </div>

    </div>
  );
}