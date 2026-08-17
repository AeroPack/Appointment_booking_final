import { useState } from 'react';
import {
  Building2,
  Activity,
  Home,
  Microscope,
  HeartPulse,
  MapPin,
  Phone,
  Edit2,
  Plus,
  CheckCircle2,
  PauseCircle,
  MapPinned,
  ArrowRight,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';
import {
  useGetVenuesQuery,
  useCreateVenueMutation,
  useUpdateVenueMutation,
  type Venue
} from '@/features/doctors/venuesApi';
import { toast } from 'sonner';

const VenueIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'building': return <Building2 className={className} />;
    case 'medical': return <Activity className={className} />;
    case 'home': return <Home className={className} />;
    case 'lab': return <Microscope className={className} />;
    case 'emergency': return <HeartPulse className={className} />;
    default: return <Building2 className={className} />;
  }
};

const getIconStyle = (type: string, isActive: boolean) => {
  if (!isActive) return 'bg-surface-container-high text-outline';
  switch (type) {
    case 'building': return 'bg-primary-fixed-dim text-on-primary-fixed';
    case 'medical': return 'bg-secondary-container text-on-secondary-container';
    case 'home': return 'bg-surface-container-high text-outline';
    case 'lab': return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    case 'emergency': return 'bg-primary-fixed text-primary';
    default: return 'bg-primary-fixed-dim text-on-primary-fixed';
  }
};

export function Venues() {
  const { data: venues, isLoading } = useGetVenuesQuery();
  const [createVenue, { isLoading: isCreating }] = useCreateVenueMutation();
  const [updateVenue] = useUpdateVenueMutation();

  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const handleToggle = async (venue: Venue) => {
    try {
      await updateVenue({ id: venue.id, is_active: !venue.is_active }).unwrap();
    } catch {
      toast.error('Failed to update venue');
    }
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setFormName(venue.name);
    setFormAddress(venue.address || '');
    setFormPhone(venue.phone || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Venue name is required');
      return;
    }
    try {
      if (editingVenue) {
        await updateVenue({
          id: editingVenue.id,
          name: formName.trim(),
          address: formAddress.trim(),
          phone: formPhone.trim(),
        }).unwrap();
        toast.success('Venue updated');
      } else {
        await createVenue({
          name: formName.trim(),
          address: formAddress.trim(),
          phone: formPhone.trim(),
        }).unwrap();
        toast.success('Venue created');
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to save venue');
    }
  };

  const resetForm = () => {
    setEditingVenue(null);
    setFormName('');
    setFormAddress('');
    setFormPhone('');
    setShowForm(false);
  };

  const activeCount = venues?.filter(v => v.is_active).length ?? 0;
  const totalCount = venues?.length ?? 0;

  return (
    <div className="min-h-screen bg-surface md:bg-background text-on-surface font-sans relative">
      <div className="hidden md:block fixed top-0 right-0 -z-10 w-1/3 h-1/3 opacity-20 pointer-events-none bg-gradient-to-bl from-primary/10 to-transparent" />

      <main className="max-w-[1200px] mx-auto px-4 md:px-10 pt-8 md:pt-12 pb-32 md:pb-16 flex flex-col gap-8 md:gap-12">
        <header className="flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary md:text-on-surface tracking-tight mb-2 md:mb-1">
              Venues<span className="hidden md:inline"> Management</span>
            </h1>
            <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl">
              <span className="md:hidden">Manage your clinical locations and operational status.</span>
              <span className="hidden md:inline">Manage clinic locations, operational status, and contact information across your network.</span>
            </p>
          </div>
          <Button
            className="hidden md:flex bg-primary hover:bg-primary-container text-on-primary h-12 px-6 rounded-full font-label-bold text-label-bold items-center gap-2 shadow-md transition-all active:scale-95"
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            <Plus className="w-5 h-5" />
            Add New Venue
          </Button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#005c55]" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {(venues ?? []).map((venue) => (
              <Card
                key={venue.id}
                className={`bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-outline-variant/30 md:border-outline-variant transition-all duration-200 group md:hover:border-primary ${!venue.is_active ? 'md:opacity-80' : ''}`}
              >
                <div className="p-4 md:p-6 flex flex-col gap-4">
                  <div className="hidden md:flex justify-between items-start mb-2">
                <div className={`p-3 rounded-lg ${getIconStyle('building', venue.is_active)}`}>
                    <VenueIcon type="building" className="w-6 h-6" />
                    </div>
                    <Switch
                      checked={venue.is_active}
                      onCheckedChange={() => handleToggle(venue)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex md:hidden justify-between items-start">
                    <div className="flex flex-col">
                      <h3 className="font-headline-md text-headline-md text-on-surface">{venue.name}</h3>
                      <span className={`inline-flex items-center gap-1 font-label-bold text-label-bold mt-1 ${venue.is_active ? 'text-status-success' : 'text-on-surface-variant'}`}>
                        {venue.is_active ? <CheckCircle2 className="w-4 h-4 fill-current text-white" /> : <PauseCircle className="w-4 h-4" />}
                        {venue.is_active ? 'Operational' : 'Inactive'}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(venue)} className="text-primary hover:bg-primary/10 rounded-full w-12 h-12 shrink-0">
                      <Edit2 className="w-5 h-5" />
                    </Button>
                  </div>

                  <h3 className="hidden md:block font-headline-md text-headline-md text-on-surface">
                    {venue.name}
                  </h3>

                  <div className={`flex flex-col gap-2 md:gap-3 md:mt-2 transition-opacity duration-200 ${!venue.is_active ? 'opacity-60 md:opacity-100' : ''}`}>
                    {venue.address && (
                      <div className="flex items-start gap-3 text-on-surface-variant">
                        <MapPin className="w-5 h-5 shrink-0" />
                        <p className="font-body-base md:font-label-bold text-body-base md:text-label-bold">{venue.address}</p>
                      </div>
                    )}
                    {venue.phone && (
                      <div className="flex items-center gap-3 text-on-surface-variant">
                        <Phone className="w-5 h-5 shrink-0" />
                        <p className="font-body-base md:font-label-bold text-body-base md:text-label-bold">{venue.phone}</p>
                      </div>
                    )}
                  </div>

                  <div className="md:hidden border-t border-outline-variant/20 pt-4 mt-2 flex items-center justify-between">
                    <span className="font-label-bold text-label-bold text-on-surface-variant">Clinic Visibility</span>
                    <Switch
                      checked={venue.is_active}
                      onCheckedChange={() => handleToggle(venue)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="hidden md:flex mt-4 pt-4 border-t border-surface-container items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={`px-3 py-1 font-label-sm text-label-sm border-0 ${
                        venue.is_active
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container-highest text-outline'
                      }`}
                    >
                      {venue.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(venue)} className="hover:bg-surface-container-high rounded-full text-outline">
                        <Edit2 className="w-[18px] h-[18px]" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            <Card className="hidden md:flex relative overflow-hidden bg-surface-container-low min-h-[300px] flex-col items-center justify-center p-8 text-center group border border-outline-variant shadow-sm hover:border-primary transition-colors cursor-pointer" onClick={() => { resetForm(); setShowForm(true); }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="bg-surface-container-lowest p-5 rounded-full mb-4 shadow-sm z-10 text-primary group-hover:scale-110 transition-transform duration-300">
                <MapPinned className="w-10 h-10" />
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface z-10">Expand Your Network</h4>
              <p className="font-label-bold text-label-bold text-on-surface-variant mt-2 max-w-[200px] z-10">Click the add button to register a new clinical location.</p>
              <div className="mt-6 font-label-bold text-label-bold text-primary flex items-center gap-2 group-hover:underline z-10">
                Learn about multi-site management
                <ArrowRight className="w-4 h-4" />
              </div>
            </Card>
          </div>
        )}

        {totalCount > 0 && (
          <footer className="hidden md:flex mt-8 justify-between items-center text-on-surface-variant">
            <p className="font-label-bold text-label-bold">Showing {activeCount} of {totalCount} active venues</p>
          </footer>
        )}
      </main>

      <div className="md:hidden fixed bottom-8 right-6 z-50">
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-6 h-14 bg-primary text-on-primary rounded-full shadow-lg active:scale-95 transition-transform hover:shadow-xl font-label-bold text-label-bold"
        >
          <Plus className="w-6 h-6" strokeWidth={3} />
          Add Venue
        </Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-[#191c1e]">{editingVenue ? 'Edit Venue' : 'Add Venue'}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-[#f2f4f6] text-[#6e7977]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#191c1e]">Venue Name</label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Central Wellness Clinic" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#191c1e]">Address</label>
                <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Full address" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#191c1e]">Phone</label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="(555) 123-4567" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={isCreating} className="flex-1 h-11 bg-[#005c55] hover:bg-[#004944] text-white rounded-xl font-semibold">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingVenue ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm} className="h-11 rounded-xl">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Venues;
