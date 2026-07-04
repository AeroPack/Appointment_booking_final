import { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Info, 
  Shield, 
  RefreshCw,
  Trash2
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { useGetDependentsQuery, useCreateDependentMutation, useDeleteDependentMutation } from '@/features/users/usersApi';

export function Family() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const { data: dependents = [], isLoading } = useGetDependentsQuery();
  const [createDependent] = useCreateDependentMutation();
  const [deleteDependent] = useDeleteDependentMutation();
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState('spouse');

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isQuickAddOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isQuickAddOpen]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0F172A] font-body-base antialiased flex flex-col relative">

      {/* ========================================== */}
      {/* MAIN CONTENT                               */}
      {/* ========================================== */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-5 py-8 md:px-10 md:py-12">
        
        <div className="mb-8 md:mb-10">
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#0F172A] tracking-tight leading-tight">Family Members</h1>
          <p className="text-[16px] text-[#64748B] mt-2">Manage health records and appointment booking for your household.</p>
        </div>

        {/* --- Grid: Members & Add Button --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {isLoading && <div className="col-span-full text-center py-8 text-slate-500">Loading dependents...</div>}

          {dependents.map((dep) => {
            const initials = dep.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
            return (
              <div key={dep.id} className="bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] border border-[#eceef0] p-6 flex flex-col justify-between hover:border-[#005c55] transition-colors group cursor-default">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-full bg-[#005c55] text-white flex items-center justify-center font-bold text-[20px] shadow-sm">
                    {initials}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => deleteDependent(dep.id)}
                      className="text-[#6e7977] hover:text-red-500 p-2 rounded-full hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0F172A] mb-0.5">{dep.name}</h3>
                  <p className="text-[11px] font-bold text-[#005c55] uppercase tracking-wider mb-2">{dep.relationship ?? 'Family Member'}</p>
                </div>
              </div>
            );
          })}

          {/* Add Member Button Card */}
          <button 
            onClick={() => setIsQuickAddOpen(true)}
            className="bg-transparent border-2 border-dashed border-[#bdc9c6] rounded-xl p-8 flex flex-col items-center justify-center gap-4 hover:border-[#005c55] hover:bg-[#f2f4f6]/50 transition-all group min-h-[200px] active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#3e4947] group-hover:bg-[#005c55] group-hover:text-white transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-semibold text-[#3e4947] group-hover:text-[#005c55] transition-colors">+ Add Family Member</span>
          </button>
        </div>

        {/* --- Info Banners --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-12">
          
          <div className="bg-[#e6fbf9] rounded-xl p-6 lg:p-8 flex gap-5 items-start">
            <div className="w-12 h-12 bg-[#005c55] rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[18px] font-bold text-[#0F172A] mb-2">Privacy Protected</h4>
              <p className="text-[15px] text-[#3e4947] leading-relaxed">
                Your family's health information is encrypted. Only you and authorized healthcare providers can access these records.
              </p>
            </div>
          </div>

          <div className="bg-[#fcf0eb] rounded-xl p-6 lg:p-8 flex gap-5 items-start">
            <div className="w-12 h-12 bg-[#7f4025] rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[18px] font-bold text-[#0F172A] mb-2">Smart Syncing</h4>
              <p className="text-[15px] text-[#3e4947] leading-relaxed">
                Easily share vaccination records and medical history across your household profile for seamless hospital visits.
              </p>
            </div>
          </div>

        </section>

        {/* --- Inline Add Form (Matches background of mobile screenshot & desktop code) --- */}
        <section className="bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] border border-[#eceef0] overflow-hidden mb-12">
          <div className="p-6 lg:p-8 border-b border-[#eceef0]">
            <h2 className="text-[20px] font-bold text-[#0F172A]">Add New Profile</h2>
            <p className="text-[14px] text-[#64748B] mt-1">Fill in the details to create a health record for your family member.</p>
          </div>
          <form className="p-6 lg:p-8" onSubmit={(e) => { e.preventDefault(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-8">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#191c1e]">Full Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="h-12 bg-white border-[#bdc9c6] focus-visible:ring-[#005c55] text-[16px] rounded-lg px-4"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#191c1e]">Relationship</label>
                <select
                  value={newRelationship}
                  onChange={(e) => setNewRelationship(e.target.value)}
                  className="w-full h-12 bg-white border border-[#bdc9c6] rounded-lg px-4 text-[16px] focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] text-[#191c1e] appearance-none"
                >
                  <option value="spouse">Spouse</option>
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={async () => {
                    if (!newName.trim()) return;
                    await createDependent({ name: newName.trim(), relationship: newRelationship });
                    setNewName('');
                    setNewRelationship('spouse');
                  }}
                  className="h-12 px-10 rounded-full bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold text-[15px] shadow-md active:scale-95 transition-all w-full md:w-auto"
                >
                  Save Member
                </Button>
              </div>
            </div>
          </form>
        </section>

      </main>

      {/* ========================================== */}
      {/* DESKTOP FOOTER                             */}
      {/* ========================================== */}
      <footer className="hidden md:block bg-[#f2f4f6] border-t border-[#eceef0] w-full mt-auto">
        <div className="max-w-[1200px] mx-auto px-10 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-start gap-1">
            <span className="font-bold text-[14px] text-[#191c1e]">Aeropack Pvt Ltd</span>
            <p className="font-medium text-[12px] text-[#64748B]">© 2024 Aeropack Pvt Ltd. All rights reserved.</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-[13px] font-medium text-[#3e4947] hover:text-[#005c55] transition-colors">Privacy Policy</a>
            <a href="#" className="text-[13px] font-medium text-[#3e4947] hover:text-[#005c55] transition-colors">Terms of Service</a>
            <a href="#" className="text-[13px] font-medium text-[#3e4947] hover:text-[#005c55] transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>

      {/* ========================================== */}
      {/* MOBILE QUICK ADD MODAL (Overlay)           */}
      {/* ========================================== */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsQuickAddOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#eceef0] flex justify-between items-center bg-white">
              <h2 className="text-[20px] font-bold text-[#0F172A]">Quick Add</h2>
              <button 
                onClick={() => setIsQuickAddOpen(false)}
                className="p-2 -mr-2 text-[#3e4947] hover:bg-[#f2f4f6] rounded-full transition-colors active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              
              {/* Info Banner */}
              <div className="flex items-center gap-3 p-4 bg-[#e6fbf9] border border-[#005c55]/20 rounded-xl mb-6">
                <Info className="w-5 h-5 text-[#005c55] shrink-0" />
                <p className="text-[13px] font-medium text-[#005c55] leading-snug">
                  Adding a family member allows you to book appointments on their behalf.
                </p>
              </div>

              {/* Form Fields */}
              <div className="space-y-5 mb-8">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[#191c1e]">Name</label>
                  <Input 
                    placeholder="e.g. John Doe" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-12 bg-white border-[#bdc9c6] focus-visible:ring-[#005c55] text-[16px] rounded-lg px-4" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[#191c1e]">Relationship</label>
                  <select
                    value={newRelationship}
                    onChange={(e) => setNewRelationship(e.target.value)}
                    className="w-full h-12 bg-white border border-[#bdc9c6] rounded-lg px-4 text-[16px] focus:outline-none focus:ring-1 focus:ring-[#005c55] focus:border-[#005c55] text-[#191c1e] appearance-none"
                  >
                    <option value="son">Son</option>
                    <option value="daughter">Daughter</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <Button 
                onClick={async () => {
                  if (!newName.trim()) return;
                  await createDependent({ name: newName.trim(), relationship: newRelationship });
                  setNewName('');
                  setNewRelationship('spouse');
                  setIsQuickAddOpen(false);
                }}
                className="w-full h-[52px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full font-bold text-[16px] shadow-md active:scale-[0.98] transition-all"
              >
                Add Dependee
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}