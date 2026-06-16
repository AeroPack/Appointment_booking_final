import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  MapPin, 
  Banknote, 
  Star, 
  CalendarDays,
  Clock,
  Navigation
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';
import { Badge } from '@/core/components/ui/badge';
import { useGetDoctorProfileQuery } from '@/features/doctors/doctorsApi';
import { useAppDispatch } from '@/core/store/hooks';
import { setDoctor } from '@/features/appointments/bookingDraftSlice';

// --- Component ---

export function DoctorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: profile, isLoading } = useGetDoctorProfileQuery(id!, { skip: !id });

  const doctor = profile ? {
    id: profile.user_id,
    name: profile.name,
    title: profile.title ?? profile.speciality ?? '',
    specialty: profile.speciality ?? '',
    qualifications: profile.qualification ? profile.qualification.split(', ').filter(Boolean) : [],
    imageUrl: profile.avatar_url ?? undefined,
    fee: profile.consultation_fee ? Number(profile.consultation_fee) : 0,
    experienceYears: profile.experience_years ?? 0,
    patientCount: profile.patient_count?.toString() ?? '0',
    awardsCount: profile.awards_count ?? 0,
    publicationsCount: profile.publications_count ?? 0,
    bio: profile.bio ?? '',
    venue: {
      name: profile.venues?.[0]?.name ?? '',
      department: '',
      address: profile.venues?.[0]?.address ?? '',
      mapImageUrl: '',
      workingHours: '',
    },
  } : null;

  if (isLoading || !doctor) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const initials = doctor.name
    .replace('Dr. ', '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleBookSlot = () => {
    dispatch(setDoctor({
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      fee: doctor.fee,
      imageUrl: null,
    }));
    navigate(`/patient/find-slots?doctorId=${doctor.id}`);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col relative">

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-5 py-6 md:px-10 md:py-10 pb-32">
        
        {/* Breadcrumb (Desktop Only) */}
        <nav className="hidden md:flex items-center gap-2 mb-8 text-on-surface-variant">
          <button onClick={() => navigate('/patient/home')} className="text-[12px] font-medium hover:text-primary">Home</button>
          <ChevronRight className="w-4 h-4" />
          <button onClick={() => navigate('/patient/doctors')} className="text-[12px] font-medium hover:text-primary">{doctor.specialty}</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[12px] font-semibold text-primary">{doctor.name}</span>
        </nav>

        {/* Mobile Hero (Hidden on Desktop) */}
        <section className="md:hidden pt-4 pb-6 bg-gradient-to-b from-primary-fixed/20 to-transparent -mx-5 px-5 mb-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Avatar className="w-32 h-32 border-4 border-surface-container-lowest shadow-lg">
              <AvatarImage src={doctor.imageUrl} alt={doctor.name} />
              <AvatarFallback className="bg-primary-container text-on-primary-container text-[40px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h1 className="text-[24px] font-bold text-primary tracking-tight">{doctor.name}</h1>
              <p className="text-[18px] text-on-surface-variant font-medium">{doctor.specialty}</p>
              <div className="mt-2">
                <Badge variant="secondary" className="bg-secondary-fixed/30 text-on-secondary-fixed-variant hover:bg-secondary-fixed/40 rounded-full font-semibold px-3 py-1 border-0">
                  {doctor.qualifications.join(', ')}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Quick Info Cards (Hidden on Desktop) */}
        <section className="md:hidden grid grid-cols-1 gap-4 mb-8">
          <Card className="border-outline-variant/30 shadow-sm rounded-xl">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-text-secondary">Primary Venue</p>
                <p className="text-[14px] font-semibold text-on-surface">{doctor.venue.name}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-outline-variant/30 shadow-sm rounded-xl">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-text-secondary">Consultation Fee</p>
                <p className="text-[14px] font-semibold text-on-surface">
                  ${doctor.fee} <span className="text-text-secondary font-normal">/ session</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Responsive Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Doctor Details & Bio */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Desktop Hero Card (Hidden on Mobile) */}
            <Card className="hidden md:block rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-outline-variant/30">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <div className="relative shrink-0">
                    <Avatar className="w-40 h-40 border-4 border-primary-fixed ring-4 ring-primary-container/10">
                      <AvatarImage src={doctor.imageUrl} alt={doctor.name} className="object-cover" />
                      <AvatarFallback className="bg-primary-container text-on-primary-container text-[48px] font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-2 right-2 bg-status-success w-6 h-6 rounded-full border-4 border-white" />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-[32px] font-bold text-text-primary tracking-tight">{doctor.name}</h1>
                      <Badge variant="secondary" className="bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 rounded-lg font-semibold px-3 py-1 border-0">
                        {doctor.qualifications.join(', ')}
                      </Badge>
                    </div>
                    <p className="text-[18px] text-[#005c55] font-semibold">{doctor.title}</p>
                    
                    <div className="flex flex-wrap gap-6 pt-2">
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <MapPin className="w-5 h-5 text-[#005c55]" />
                        <span className="text-[14px] font-semibold">{doctor.venue.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <Banknote className="w-5 h-5 text-[#005c55]" />
                        <span className="text-[14px] font-semibold">${doctor.fee} / session</span>
                      </div>
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <Star className="w-5 h-5 text-status-warning fill-current" />
                        <span className="text-[14px] font-semibold text-text-secondary">Reviews coming soon</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Bio Card */}
            <Card className="rounded-xl shadow-sm md:shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-outline-variant/30 bg-surface-container-lowest md:bg-white">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-[20px] font-semibold text-[#005c55] md:text-text-primary mb-3 md:mb-4">
                  {window?.innerWidth < 768 ? 'Professional Bio' : 'About the Doctor'}
                </h2>
                <p className="text-[16px] text-on-surface-variant leading-relaxed">
                  {doctor.bio}
                </p>

                {/* Desktop Stats Grid (Hidden on Mobile) */}
                <div className="hidden md:grid grid-cols-4 gap-4 mt-8">
                  <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 text-center">
                    <div className="text-[#005c55] font-bold text-xl">{doctor.experienceYears}+</div>
                    <div className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wider mt-1">Years Exp</div>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 text-center">
                    <div className="text-[#005c55] font-bold text-xl">{doctor.patientCount}</div>
                    <div className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wider mt-1">Patients</div>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 text-center">
                    <div className="text-[#005c55] font-bold text-xl">{doctor.awardsCount}</div>
                    <div className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wider mt-1">Awards</div>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 text-center">
                    <div className="text-[#005c55] font-bold text-xl">{doctor.publicationsCount}</div>
                    <div className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wider mt-1">Publications</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Map View (Hidden on Desktop) */}
            <div className="md:hidden mt-6 rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 aspect-video relative group bg-surface-container-highest">
              {doctor.venue.mapImageUrl ? (
                <img 
                  src={doctor.venue.mapImageUrl} 
                  alt={`Map location of ${doctor.venue.name}`} 
                  className="w-full h-full object-cover grayscale-[20%] transition-all duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-50">
                  <MapPin className="w-10 h-10 text-primary" />
                </div>
              )}
              
              <div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-lg flex justify-between items-center shadow-lg border border-outline-variant/20">
                <div>
                  <p className="text-[14px] font-bold text-text-primary">{doctor.venue.name}</p>
                  <p className="text-[12px] font-medium text-text-secondary">{doctor.venue.address}</p>
                </div>
                <button className="bg-[#005c55] text-white p-2.5 rounded-full active:scale-95 transition-transform flex items-center justify-center">
                  <Navigation className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Sidebar (Hidden on Mobile) */}
          <aside className="hidden lg:block lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            {/* Venue Details Card */}
            <Card className="rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-outline-variant/30">
              <CardContent className="p-6">
                <h3 className="text-[20px] font-semibold text-text-primary mb-6">Venue Details</h3>
                
                <div className="space-y-5">
                  <div className="flex gap-4">
                    <MapPin className="w-6 h-6 text-[#005c55] shrink-0" />
                    <div>
                      <p className="text-[14px] font-bold text-text-primary">{doctor.venue.name}</p>
                      <p className="text-[12px] font-medium text-on-surface-variant mt-0.5">{doctor.venue.department}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Clock className="w-6 h-6 text-[#005c55] shrink-0" />
                    <div>
                      <p className="text-[14px] font-bold text-text-primary">Working Hours</p>
                      <p className="text-[12px] font-medium text-on-surface-variant mt-0.5">{doctor.venue.workingHours}</p>
                    </div>
                  </div>
                </div>

                {/* Map Interface */}
                <div className="mt-6 rounded-lg overflow-hidden border border-outline-variant/30 relative h-48 bg-surface-container-highest group cursor-pointer">
                  {doctor.venue.mapImageUrl ? (
                    <img 
                      src={doctor.venue.mapImageUrl} 
                      alt={`Map location of ${doctor.venue.name}`} 
                      className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-50">
                      <MapPin className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-[#005c55] text-white p-2.5 rounded-full shadow-lg">
                      <MapPin className="w-6 h-6 fill-current" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded text-[11px] font-bold text-on-surface-variant shadow-sm border border-outline-variant/10">
                    {doctor.venue.address}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Memberships — coming soon */}
            <div className="bg-[#0f766e]/5 p-6 rounded-xl border border-[#0f766e]/10">
              <p className="text-[14px] font-bold text-[#005c55] mb-4">Professional Memberships</p>
              <p className="text-[12px] font-medium text-on-surface-variant">Coming soon</p>
            </div>

          </aside>

        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 z-40 p-4 md:p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Desktop Fee Display */}
          <div className="hidden md:block">
            <p className="text-[12px] text-on-surface-variant font-medium uppercase tracking-wider">Appointment Fee</p>
            <p className="text-[20px] font-semibold text-text-primary mt-1">
              ${doctor.fee.toFixed(2)} <span className="text-[16px] text-on-surface-variant font-normal">per consultation</span>
            </p>
          </div>
          
          {/* Action Button */}
          <Button 
            onClick={handleBookSlot}
            className="w-full md:w-auto md:px-12 h-[48px] md:h-[56px] bg-[#005c55] hover:bg-[#0d6b63] text-white rounded-full text-[16px] font-semibold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 group"
          >
            <span className="md:hidden">Find available slots</span>
            <span className="hidden md:inline">Find Available Slots</span>
            <CalendarDays className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>

        </div>
      </div>
      
    </div>
  );
}