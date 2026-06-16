import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  SlidersHorizontal,
  Bookmark,
  MapPin,
  Banknote
} from 'lucide-react';
import { useListDoctorsQuery } from '@/features/doctors/doctorsApi';
import { useAppDispatch } from '@/core/store/hooks';
import { setDoctor } from '@/features/appointments/bookingDraftSlice';

function getStatusBadge(availableToday: boolean) {
  if (availableToday) {
    return {
      text: 'Available Today',
      bgClass: 'bg-status-success/10',
      textClass: 'text-status-success',
      dotClass: 'bg-status-success',
    };
  }
  return {
    text: 'Unavailable Today',
    bgClass: 'bg-text-muted/10',
    textClass: 'text-text-muted',
    dotClass: 'bg-text-muted',
  };
}

export function DoctorList() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('');

  const { data: doctors, isLoading } = useListDoctorsQuery({});

  const handleCardClick = (doctorId: string) => {
    navigate(`/patient/doctor/${doctorId}`);
  };

  const handleBookAppointment = (
    e: React.MouseEvent,
    doc: { id: string; name: string; speciality: string | null; consultation_fee: string | null; avatar_url?: string }
  ) => {
    e.stopPropagation();
    
    // Save the selected doctor to the booking draft state before navigating
    dispatch(setDoctor({
      doctorId: doc.id,
      doctorName: doc.name,
      doctorSpecialty: doc.speciality,
      fee: doc.consultation_fee ? Number(doc.consultation_fee) : null,
      imageUrl: doc.avatar_url ?? null,
    }));
    
    navigate('/patient/find-slots');
  };

  const specialties = useMemo(() => {
    if (!doctors) return [];
    return [...new Set(doctors.map(d => d.speciality).filter(Boolean) as string[])];
  }, [doctors]);

  // Filter doctors based on search and department
  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (doc.speciality && doc.speciality.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = department === '' || (doc.speciality && doc.speciality.toLowerCase() === department.toLowerCase());
      return matchesSearch && matchesDept;
    });
  }, [doctors, searchTerm, department]);

  return (
    <div className="bg-surface text-on-surface min-h-screen selection:bg-primary-fixed selection:text-on-primary-fixed">
      <main className="max-w-7xl mx-auto px-4 md:px-10 py-12">
        
        {/* Header Section */}
        <header className="mb-12">
          <h1 className="font-headline-lg text-headline-lg text-text-main mb-2">Choose a Doctor</h1>
          <p className="font-body-base text-body-base text-text-muted">
            Select from our network of world-class specialists for your care journey.
          </p>
        </header>

        {/* Search and Filter Bar */}
        <section className="mb-8 md:mb-12 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block font-label-bold text-label-bold text-on-surface-variant mb-2" htmlFor="doctor-search">
              Search
            </label>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
              <input 
                id="doctor-search" 
                type="text"
                placeholder="Search by name or specialty..." 
                className="w-full h-12 pl-12 pr-4 bg-surface-card border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-body-base text-body-base transition-all duration-200 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-64">
            <label className="block font-label-bold text-label-bold text-on-surface-variant mb-2" htmlFor="dept-filter">
              Department
            </label>
            <div className="relative">
              <select 
                id="dept-filter"
                className="w-full h-12 px-4 bg-surface-card border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-body-base text-body-base appearance-none cursor-pointer outline-none"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All Departments</option>
                {specialties.map(s => (
                  <option key={s} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-outline" />
            </div>
          </div>
          <button className="h-12 px-6 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-bold text-label-bold rounded-xl transition-colors flex items-center justify-center gap-2">
            <SlidersHorizontal className="w-5 h-5" />
            Filters
          </button>
        </section>

        {/* Doctor Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="text-center py-20 bg-surface-card rounded-xl border border-surface-container shadow-sm">
            <p className="font-headline-md text-headline-md text-text-main mb-2">No doctors found</p>
            <p className="text-text-muted font-body-base">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredDoctors.map((doc) => {
              const status = getStatusBadge(doc.available_today);
              const fallbackInitials = doc.name.replace('Dr. ', '').substring(0, 2).toUpperCase();

              return (
                <article 
                  key={doc.id}
                  onClick={() => handleCardClick(doc.id)}
                  className="bg-surface-card rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.1)] hover:border-primary/20 transition-all duration-300 flex flex-col group cursor-pointer"
                >
                  <div className="flex items-start gap-4 mb-6">
                    {doc.avatar_url ? (
                      <img 
                        src={doc.avatar_url} 
                        alt={doc.name} 
                        className="w-20 h-20 rounded-full object-cover border-2 border-primary-fixed-dim p-0.5 shrink-0" 
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full border-2 border-primary-fixed-dim p-0.5 shrink-0 flex items-center justify-center bg-surface-container-high text-text-main font-headline-md">
                        {fallbackInitials}
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-headline-md text-headline-md text-text-main leading-tight group-hover:text-primary transition-colors">
                          {doc.name}
                        </h3>
                        <div 
                          className="p-1 -mt-1 -mr-1"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Bookmark className="w-5 h-5 text-outline cursor-pointer hover:text-primary transition-colors" />
                        </div>
                      </div>
                      <p className="font-label-bold text-label-bold text-primary mt-1">
                        {doc.speciality || 'General Medicine'}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 ${status.bgClass} ${status.textClass} text-label-sm font-label-bold rounded-lg flex items-center gap-1.5`}>
                          <span className={`w-1.5 h-1.5 ${status.dotClass} rounded-full`}></span>
                          {status.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="font-body-base text-body-base text-on-surface-variant line-clamp-2 mb-6 flex-grow">
                    {doc.bio || `Expert in ${doc.speciality?.toLowerCase() || 'general medicine'} with ${doc.experience_years || 'several'} years of experience.`}
                  </p>

                  <div className="space-y-3 mb-6 pt-4 border-t border-surface-container">
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <MapPin className="w-[18px] h-[18px]" />
                      <span className="font-body-base text-body-base">
                        {doc.primary_venue_name || 'Multiple locations'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <Banknote className="w-[18px] h-[18px]" />
                      <span className="font-body-base text-body-base font-semibold">
                        {doc.consultation_fee ? `$${doc.consultation_fee}` : 'Price varies'} / session
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => handleBookAppointment(e, doc)}
                    className="w-full h-12 bg-primary hover:bg-primary-container text-on-primary font-label-bold text-label-bold rounded-full transition-all duration-200 active:scale-[0.98] outline-none"
                  >
                    View Schedule
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}