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
  Trash2,
  Plus,
  CheckCircle2,
  PauseCircle,
  MapPinned,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Switch } from '@/core/components/ui/switch';

// --- Types & Mock Data ---

export interface Venue {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  iconType: 'building' | 'medical' | 'home' | 'lab' | 'emergency';
}

const INITIAL_VENUES: Venue[] = [
  {
    id: 'v1',
    name: 'Central Wellness Clinic',
    address: '128 Healthcare Plaza, Suite 400, Downtown Metro',
    phone: '(555) 123-4567',
    isActive: true,
    iconType: 'building',
  },
  {
    id: 'v2',
    name: 'Eastside Rehabilitation',
    address: '4521 Sunrise Blvd, Building B, East District',
    phone: '(555) 987-6543',
    isActive: true,
    iconType: 'medical',
  },
  {
    id: 'v3',
    name: 'North Hill Pediatrics',
    address: '92 Skyview Dr, North Heights',
    phone: '(555) 222-3344',
    isActive: false,
    iconType: 'home',
  },
  {
    id: 'v4',
    name: 'Advanced Diagnostic Lab',
    address: '88 Innovation Way, Tech Park',
    phone: '(555) 555-0199',
    isActive: true,
    iconType: 'lab',
  },
  {
    id: 'v5',
    name: 'City Urgent Care',
    address: '12 Main St, South Crossing',
    phone: '(555) 345-6789',
    isActive: true,
    iconType: 'emergency',
  },
];

// --- Helper Components ---

const VenueIcon = ({ type, className }: { type: Venue['iconType']; className?: string }) => {
  switch (type) {
    case 'building': return <Building2 className={className} />;
    case 'medical': return <Activity className={className} />;
    case 'home': return <Home className={className} />;
    case 'lab': return <Microscope className={className} />;
    case 'emergency': return <HeartPulse className={className} />;
    default: return <Building2 className={className} />;
  }
};

const getIconStyle = (type: Venue['iconType'], isActive: boolean) => {
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

// --- Main Component ---

export function Venues() {
  const [venues, setVenues] = useState<Venue[]>(INITIAL_VENUES);

  const handleToggle = (id: string) => {
    setVenues(prev => prev.map(v => 
      v.id === id ? { ...v, isActive: !v.isActive } : v
    ));
  };

  const handleEdit = (id: string) => {
    console.log('Edit venue:', id);
  };

  const handleDelete = (id: string) => {
    console.log('Delete venue:', id);
  };

  const handleAddVenue = () => {
    console.log('Add new venue');
  };

  return (
    <div className="min-h-screen bg-surface md:bg-background text-on-surface font-sans relative">
      
      {/* Decorative Desktop Background */}
      <div className="hidden md:block fixed top-0 right-0 -z-10 w-1/3 h-1/3 opacity-20 pointer-events-none bg-gradient-to-bl from-primary/10 to-transparent"></div>

      <main className="max-w-[1200px] mx-auto px-4 md:px-10 pt-8 md:pt-12 pb-32 md:pb-16 flex flex-col gap-8 md:gap-12">
        
        {/* --- HEADER --- */}
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
          
          {/* Desktop Add Button */}
          <Button 
            className="hidden md:flex bg-primary hover:bg-primary-container text-on-primary h-12 px-6 rounded-full font-label-bold text-label-bold items-center gap-2 shadow-md transition-all active:scale-95"
            onClick={handleAddVenue}
          >
            <Plus className="w-5 h-5" />
            Add New Venue
          </Button>
        </header>

        {/* --- GRID / LIST --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          
          {venues.map((venue) => (
            <Card 
              key={venue.id} 
              className={`bg-surface-card rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-outline-variant/30 md:border-outline-variant transition-all duration-200 group md:hover:border-primary ${!venue.isActive ? 'md:opacity-80' : ''}`}
            >
              <div className="p-4 md:p-6 flex flex-col gap-4">
                
                {/* TOP ROW: Desktop Icon & Switch | Mobile Title & Edit */}
                <div className="hidden md:flex justify-between items-start mb-2">
                  <div className={`p-3 rounded-lg ${getIconStyle(venue.iconType, venue.isActive)}`}>
                    <VenueIcon type={venue.iconType} className="w-6 h-6" />
                  </div>
                  <Switch 
                    checked={venue.isActive} 
                    onCheckedChange={() => handleToggle(venue.id)} 
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex md:hidden justify-between items-start">
                  <div className="flex flex-col">
                    <h3 className="font-headline-md text-headline-md text-on-surface">{venue.name}</h3>
                    <span className={`inline-flex items-center gap-1 font-label-bold text-label-bold mt-1 ${venue.isActive ? 'text-status-success' : 'text-on-surface-variant'}`}>
                      {venue.isActive ? <CheckCircle2 className="w-4 h-4 fill-current text-white" /> : <PauseCircle className="w-4 h-4" />}
                      {venue.isActive ? 'Operational' : 'Inactive'}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(venue.id)} className="text-primary hover:bg-primary/10 rounded-full w-12 h-12 shrink-0">
                    <Edit2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* DESKTOP TITLE */}
                <h3 className="hidden md:block font-headline-md text-headline-md text-on-surface">
                  {venue.name}
                </h3>

                {/* DETAILS */}
                <div className={`flex flex-col gap-2 md:gap-3 md:mt-2 transition-opacity duration-200 ${!venue.isActive ? 'opacity-60 md:opacity-100' : ''}`}>
                  <div className="flex items-start gap-3 text-on-surface-variant">
                    <MapPin className="w-5 h-5 shrink-0" />
                    <p className="font-body-base md:font-label-bold text-body-base md:text-label-bold">{venue.address}</p>
                  </div>
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <Phone className="w-5 h-5 shrink-0" />
                    <p className="font-body-base md:font-label-bold text-body-base md:text-label-bold">{venue.phone}</p>
                  </div>
                </div>

                {/* BOTTOM ROW: Mobile Visibility Toggle | Desktop Pill & Actions */}
                <div className="md:hidden border-t border-outline-variant/20 pt-4 mt-2 flex items-center justify-between">
                  <span className="font-label-bold text-label-bold text-on-surface-variant">Clinic Visibility</span>
                  <Switch 
                    checked={venue.isActive} 
                    onCheckedChange={() => handleToggle(venue.id)} 
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="hidden md:flex mt-4 pt-4 border-t border-surface-container items-center justify-between">
                  <Badge 
                    variant="secondary" 
                    className={`px-3 py-1 font-label-sm text-label-sm border-0 ${
                      venue.isActive 
                        ? 'bg-secondary-container text-on-secondary-container' 
                        : 'bg-surface-container-highest text-outline'
                    }`}
                  >
                    {venue.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(venue.id)} className="hover:bg-surface-container-high rounded-full text-outline">
                      <Edit2 className="w-[18px] h-[18px]" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(venue.id)} className="hover:bg-error-container hover:text-error rounded-full text-outline">
                      <Trash2 className="w-[18px] h-[18px]" />
                    </Button>
                  </div>
                </div>

              </div>
            </Card>
          ))}

          {/* Desktop "Expand Network" CTA Card */}
          <Card className="hidden md:flex relative overflow-hidden bg-surface-container-low min-h-[300px] flex-col items-center justify-center p-8 text-center group border border-outline-variant shadow-sm hover:border-primary transition-colors cursor-pointer" onClick={handleAddVenue}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-50 group-hover:opacity-100 transition-opacity"></div>
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

        {/* Desktop Pagination Footer */}
        <footer className="hidden md:flex mt-8 justify-between items-center text-on-surface-variant">
          <p className="font-label-bold text-label-bold">Showing 5 of 5 active venues</p>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" disabled className="rounded-full w-10 h-10">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-label-bold text-label-bold bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded-full">
              1
            </span>
            <Button variant="outline" size="icon" disabled className="rounded-full w-10 h-10">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </footer>

      </main>

      {/* Mobile Floating Action Button */}
      <div className="md:hidden fixed bottom-8 right-6 z-50">
        <Button 
          onClick={handleAddVenue}
          className="flex items-center gap-2 px-6 h-14 bg-primary text-on-primary rounded-full shadow-lg active:scale-95 transition-transform hover:shadow-xl font-label-bold text-label-bold"
        >
          <Plus className="w-6 h-6" strokeWidth={3} />
          Add Venue
        </Button>
      </div>

    </div>
  );
}

export default Venues;