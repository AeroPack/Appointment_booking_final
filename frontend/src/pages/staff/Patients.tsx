import { useState, useEffect } from 'react';
import {
  Search,
  X,
  ChevronRight,
  CheckCircle2,
  UserPlus,
  Loader2
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Avatar, AvatarFallback } from '@/core/components/ui/avatar';
import { Input } from '@/core/components/ui/input';
import { useLazySearchPatientsQuery } from '@/features/users/usersApi';
import {
  useGetTagsQuery,
  useGetUserTagsQuery,
  useAssignTagMutation,
  useUnassignTagMutation,
  type Tag
} from '@/features/tags/tagsApi';
import { toast } from 'sonner';

interface PatientRow {
  id: string;
  name: string;
  email: string | null;
  mobile_number: string | null;
}

const COLOR_MAP: Record<string, string> = {
  '#00201d': 'bg-[#00201d]',
  '#005c55': 'bg-[#005c55]',
  '#7f4025': 'bg-[#7f4025]',
  '#DC2626': 'bg-[#DC2626]',
  '#F59E0B': 'bg-[#F59E0B]',
  '#16A34A': 'bg-[#16A34A]',
  '#6e7977': 'bg-[#6e7977]',
  '#006f64': 'bg-[#006f64]',
  '#4fdbc8': 'bg-[#4fdbc8]',
};

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Patients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const [triggerSearch, { data: searchResults, isLoading }] = useLazySearchPatientsQuery();
  const { data: allTags } = useGetTagsQuery();
  const { data: selectedUserTags } = useGetUserTagsQuery(
    selectedPatient?.id ?? '',
    { skip: !selectedPatient }
  );
  const [assignTag] = useAssignTagMutation();
  const [unassignTag] = useUnassignTagMutation();

  const patients: PatientRow[] = (searchResults ?? []).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile_number: u.mobile_number,
  }));

  useEffect(() => {
    triggerSearch(searchQuery ? { q: searchQuery } : {});
  }, [searchQuery, triggerSearch]);

  useEffect(() => {
    if (isMobileSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileSheetOpen]);

  const handleRowClick = (patient: PatientRow) => {
    setSelectedPatient(patient);
    if (window.innerWidth < 768) {
      setIsMobileSheetOpen(true);
    }
  };

  const handleToggleTag = async (tag: Tag) => {
    if (!selectedPatient) return;
    const isAssigned = selectedUserTags?.some(ut => ut.id === tag.id);
    try {
      if (isAssigned) {
        await unassignTag({ userId: selectedPatient.id, tagId: tag.id }).unwrap();
        toast.success(`Removed "${tag.name}"`);
      } else {
        await assignTag({ userId: selectedPatient.id, tagId: tag.id }).unwrap();
        toast.success(`Assigned "${tag.name}"`);
      }
    } catch {
      toast.error('Failed to update tag');
    }
  };

  const assignedTagIds = new Set(selectedUserTags?.map(t => t.id) ?? []);

  return (
    <div className="min-h-screen md:h-screen bg-[#f7f9fb] font-body-base text-[#191c1e] flex flex-col md:flex-row overflow-hidden antialiased">

      {/* MOBILE VIEW */}
      <div className="md:hidden flex-1 flex flex-col w-full h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
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

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#005c55]" /></div>
            ) : patients.length === 0 ? (
              <div className="text-center py-12 text-[#6e7977]">
                <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-[14px] font-medium">No patients found</p>
              </div>
            ) : (
              patients.map(patient => (
                <Card
                  key={patient.id}
                  onClick={() => handleRowClick(patient)}
                  className="rounded-xl border-transparent shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] active:bg-[#f2f4f6] transition-colors cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-[20px] font-semibold text-[#191c1e] leading-tight">
                          {patient.name}
                        </h3>
                        <p className="text-[12px] font-medium text-[#6e7977] mt-0.5">{patient.mobile_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-[#bdc9c6]/30">
                      <span className="text-[12px] font-medium text-[#6e7977]">
                        Registered: recently
                      </span>
                      <ChevronRight className="w-5 h-5 text-[#6e7977]" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {isMobileSheetOpen && selectedPatient && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileSheetOpen(false)} />
            <div className="relative bg-[#f7f9fb] w-full rounded-t-[28px] shadow-2xl pb-8 flex flex-col max-h-[90vh]">
              <div className="flex justify-center pt-4 pb-2 shrink-0">
                <div className="w-12 h-1.5 bg-[#bdc9c6] rounded-full" />
              </div>
              <div className="px-5 overflow-y-auto shrink-0 pb-safe">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[24px] font-bold text-[#191c1e]">
                      {selectedPatient.name}
                  </h2>
                  <button onClick={() => setIsMobileSheetOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#e6e8ea] text-[#3e4947]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-[14px] font-semibold text-[#6e7977] mb-4">Manage Tags</p>
                <div className="grid grid-cols-1 gap-3 mb-8">
                  {(allTags ?? []).map(tag => {
                    const active = assignedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag)}
                        className={`flex items-center justify-between p-4 bg-[#f2f4f6] rounded-xl border transition-all ${active ? 'border-[#80d5cb]' : 'border-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full ${COLOR_MAP[tag.color || '#6e7977'] || 'bg-[#6e7977]'}`} />
                          <span className="text-[16px] text-[#191c1e]">{tag.name}</span>
                        </div>
                        {active && <CheckCircle2 className="w-6 h-6 text-[#005c55]" />}
                      </button>
                    );
                  })}
                </div>
                <Button
                  onClick={() => setIsMobileSheetOpen(false)}
                  className="w-full h-[52px] rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold text-[16px] shadow-md"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:flex flex-1 w-full h-full overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#bdc9c6] bg-[#f7f9fb]">
          <header className="p-6 lg:px-8 bg-white shadow-sm space-y-5 z-10 shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-[32px] font-bold text-[#005c55] tracking-tight">Patient Directory</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e7977]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email or phone..."
                  className="w-full h-12 pl-12 pr-4 bg-[#f2f4f6] border-0 focus-visible:ring-2 focus-visible:ring-[#005c55] rounded-xl text-[16px]"
                />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#f2f4f6] z-10 shadow-sm border-b border-[#bdc9c6]">
                <tr className="text-left">
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Patient</th>
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Contact</th>
                  <th className="px-6 lg:px-8 py-4 text-[14px] font-bold text-[#3e4947] uppercase tracking-wider">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bdc9c6]/50">
                {isLoading ? (
                  <tr><td colSpan={3} className="px-8 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#005c55] mx-auto" /></td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={3} className="px-8 py-12 text-center text-[#6e7977]">No patients found</td></tr>
                ) : (
                  patients.map(patient => (
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
                          <Avatar className="w-12 h-12 rounded-full bg-[#0f766e] border-0 flex items-center justify-center shrink-0">
                            <AvatarFallback className="text-white font-bold text-[16px] bg-transparent">
                              {getInitials(patient.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-[16px] text-[#191c1e]">
                              {patient.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 lg:px-8 py-4 text-[16px] text-[#3e4947]">{patient.email || patient.mobile_number}</td>
                      <td className="px-6 lg:px-8 py-4 text-[16px] text-[#3e4947]">recently</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedPatient && (
          <aside className="w-96 bg-white border-l border-[#bdc9c6] shadow-2xl flex flex-col shrink-0 z-20 transition-all duration-300">
            <div className="p-6 border-b border-[#e0e3e5] flex items-center justify-between shrink-0 bg-white">
              <h2 className="text-[20px] font-semibold text-[#191c1e]">Patient Details</h2>
              <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-[#f2f4f6] rounded-full transition-colors text-[#6e7977]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#f7f9fb]">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 rounded-2xl bg-[#0f766e] border-0 flex items-center justify-center shrink-0">
                    <AvatarFallback className="text-white font-bold text-[24px] bg-transparent">
                      {getInitials(selectedPatient.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#191c1e]">
                    {selectedPatient.name}
                    </h3>
                    <p className="text-[12px] font-medium text-[#6e7977]">ID: {selectedPatient.id.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#eceef0] rounded-xl">
                    <div className="text-[12px] font-medium text-[#6e7977] mb-1">Email</div>
                    <div className="text-[14px] font-semibold text-[#191c1e] truncate">{selectedPatient.email || '-'}</div>
                  </div>
                  <div className="p-4 bg-[#eceef0] rounded-xl">
                    <div className="text-[12px] font-medium text-[#6e7977] mb-1">Phone</div>
                    <div className="text-[14px] font-semibold text-[#191c1e]">{selectedPatient.mobile_number || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[12px] font-bold text-[#3e4947] uppercase tracking-wider">Clinical Tags</h4>
                <div className="space-y-3">
                  {(allTags ?? []).map(tag => {
                    const isAssigned = assignedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag)}
                        className={`w-full p-3 bg-white border rounded-xl flex items-center justify-between group transition-colors hover:border-[#bdc9c6] ${
                          isAssigned ? 'border-[#005c55]' : 'border-[#e0e3e5]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${COLOR_MAP[tag.color || '#6e7977'] || 'bg-[#6e7977]'}`} />
                          <span className="text-[14px] font-semibold text-[#191c1e]">{tag.name}</span>
                        </div>
                        {isAssigned && <CheckCircle2 className="w-5 h-5 text-[#005c55]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
