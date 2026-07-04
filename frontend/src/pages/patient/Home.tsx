import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  PlusCircle, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  ArrowRight,
  ClipboardList,
  ShieldCheck, 
  FolderOpen, 
  Lightbulb,
  Leaf,
  Clock,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar';
import { Badge } from '@/core/components/ui/badge';
import { useGetMeQuery } from '@/features/users/usersApi';
import { useGetMyAppointmentsQuery } from '@/features/appointments/appointmentsApi';
import { useGetDependentsQuery } from '@/features/users/usersApi';

// --- Component ---

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { data: user } = useGetMeQuery();
  const { data: appointments } = useGetMyAppointmentsQuery({ status: 'booked' });
  const { data: dependents } = useGetDependentsQuery();

  const upcomingAppointment = appointments?.[0] ? {
    id: appointments[0].id,
    doctorName: appointments[0].doctor_name,
    specialty: '',
    institution: appointments[0].venue_name ?? '',
    token: appointments[0].token_number?.toString() ?? '',
    status: 'Confirmed' as const,
    date: new Date(appointments[0].scheduled_start).toLocaleDateString(),
    time: new Date(appointments[0].scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    venue: appointments[0].venue_name ?? '',
    imageUrl: '',
  } : undefined;

  const familyMembers = [
    { id: 'me', name: user?.name ?? 'Me', imageUrl: user?.avatar_url ?? '', isMe: true as const },
    ...(dependents?.map((d) => ({
      id: d.id,
      name: d.name,
      imageUrl: '',
      isMe: false as const,
    })) ?? []),
  ];

  const patientName = user?.name ?? 'Guest';
  const appointmentCount = appointments?.length ?? 0;
  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col">
      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto w-full px-5 py-8 md:px-10 md:py-10 flex-grow">
        
        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-[24px] md:text-[32px] font-bold tracking-tight text-text-primary">
              Hello, {patientName}
            </h1>
            <p className="text-[16px] md:text-[18px] text-text-secondary mt-1 md:mt-2">
              <span className="md:hidden">Take care of your health today.</span>
              <span className="hidden md:inline">Welcome back. You have {appointmentCount} appointment scheduled for today.</span>
            </p>
          </div>
          <Button 
            onClick={() => navigate('/patient/doctors')}
            className="hidden md:flex bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full px-8 py-6 shadow-sm font-semibold transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 mr-2" />
            Book an appointment
          </Button>
        </section>

        {/* Dashboard Grid */}
        <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 items-start">
          
          {/* Primary Column: Appointments & Family */}
          <div className="md:col-span-8 flex flex-col gap-6 md:gap-8 w-full">
            
            {/* Upcoming Appointment Card */}
            {upcomingAppointment && (
              <Card className="rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container overflow-hidden group relative">
                {/* Desktop Background Blob */}
                <div className="hidden md:block absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                
                <CardContent className="p-5 md:p-8 relative z-10">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4 md:mb-6">
                    <div className="flex gap-4 md:block">
                      {/* Mobile Avatar */}
                      <Avatar className="w-14 h-14 md:hidden border border-surface-container">
                        <AvatarImage src={upcomingAppointment.imageUrl} alt={upcomingAppointment.doctorName} />
                        <AvatarFallback>{upcomingAppointment.doctorName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <Badge variant="secondary" className="hidden md:inline-flex bg-secondary-container text-on-secondary-container hover:bg-secondary-container mb-4 text-[12px] uppercase tracking-wider font-semibold border-0 rounded-lg">
                          Upcoming Appointment
                        </Badge>
                        <h3 className="text-[20px] font-semibold text-text-primary md:mb-1">{upcomingAppointment.doctorName}</h3>
                        <p className="text-[12px] md:text-[16px] text-primary md:text-text-secondary uppercase md:normal-case tracking-wider md:tracking-normal font-medium md:font-normal mt-1 md:mt-0">
                          {upcomingAppointment.specialty} <span className="hidden md:inline">• {upcomingAppointment.institution}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <Badge variant="outline" className="bg-[#0f766e] md:bg-transparent text-white md:text-[#005c55] border-0 md:border-none text-[14px] font-semibold md:mb-1 px-3 py-1 md:px-0 md:py-0 rounded-lg">
                        Token {upcomingAppointment.token}
                      </Badge>
                      <div className="hidden md:flex items-center gap-2 text-status-success">
                        <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                        <span className="text-[12px] font-semibold">Confirmed</span>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid/List */}
                  <div className="py-2 md:py-6 border-y md:border-t md:border-b-0 border-surface-container-low flex flex-col md:grid md:grid-cols-3 gap-2 md:gap-6">
                    {/* Mobile Format */}
                    <div className="md:hidden flex items-center gap-3 text-text-secondary mb-1">
                      <Calendar className="w-5 h-5" />
                      <span className="text-[16px] text-on-surface">{upcomingAppointment.date} at {upcomingAppointment.time}</span>
                    </div>
                    <div className="md:hidden flex items-center gap-3 text-text-secondary">
                      <MapPin className="w-5 h-5" />
                      <span className="text-[16px] text-on-surface">{upcomingAppointment.venue}</span>
                    </div>

                    {/* Desktop Format */}
                    <div className="hidden md:flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-[#005c55]">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-text-secondary">Date</p>
                        <p className="text-[14px] font-semibold text-on-surface">{upcomingAppointment.date}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-[#005c55]">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-text-secondary">Time</p>
                        <p className="text-[14px] font-semibold text-on-surface">{upcomingAppointment.time}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-[#005c55]">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-text-secondary">Venue</p>
                        <p className="text-[14px] font-semibold text-on-surface">{upcomingAppointment.venue}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex justify-between items-center mt-4 md:mt-6">
                    <button 
                      onClick={() => navigate(`/patient/appointment/${upcomingAppointment.id}`)}
                      className="text-[#005c55] font-semibold text-[14px] flex items-center gap-1 hover:underline transition-all"
                    >
                      {window?.innerWidth < 768 ? 'View Appointment Details' : 'View Details'}
                      {window?.innerWidth < 768 ? <ChevronRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                    </button>
                    
                    {/* Mobile Confirmation Status */}
                    <div className="md:hidden flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                      <span className="text-[12px] font-semibold text-status-success">Confirmed</span>
                    </div>

                    {/* Desktop Action Buttons */}
                    <div className="hidden md:flex gap-3">
                      <Button variant="outline" onClick={() => navigate(`/patient/find-slots?doctorId=${upcomingAppointment.id}`)} className="h-10 px-4 rounded-lg border-outline-variant text-on-surface-variant font-semibold text-[12px] hover:bg-surface-container-low transition-colors">
                        Reschedule
                      </Button>
                      <Button variant="ghost" className="h-10 px-4 rounded-lg bg-[#005c55]/10 text-[#005c55] hover:bg-[#005c55]/20 font-semibold text-[12px] transition-colors">
                        Get Directions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mobile-Only Book Appointment Button */}
            <Button 
              onClick={() => navigate('/patient/doctors')}
              className="md:hidden w-full h-[48px] bg-[#005c55] text-white rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-[#0f766e] active:scale-95 transition-all shadow-md"
            >
              <PlusCircle className="w-5 h-5" />
              Book an appointment
            </Button>

            {/* Family Section */}
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2 md:mb-0">
                <h2 className="text-[20px] md:text-[14px] font-semibold md:font-bold text-text-primary md:uppercase md:tracking-widest md:opacity-60">
                  Your family
                </h2>
                <button onClick={() => navigate('/patient/family')} className="text-[#005c55] font-semibold text-[14px] md:text-[12px] hover:underline">
                  {window?.innerWidth < 768 ? 'Manage' : 'Manage All'}
                </button>
              </div>
              <div className="flex gap-4 md:gap-6 overflow-x-auto pb-2 scrollbar-hide items-center">
                {familyMembers.map((member) => (
                  <button key={member.id} className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer group outline-none">
                    <div className={`w-16 h-16 rounded-full p-1 border-2 transition-all group-hover:ring-2 group-hover:ring-[#005c55]/20 ${member.isMe ? 'border-[#005c55]' : 'border-transparent group-hover:border-surface-container'}`}>
                      <Avatar className="w-full h-full">
                        <AvatarImage src={member.imageUrl} alt={member.name} className="object-cover" />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <span className={`text-[12px] md:text-[14px] ${member.isMe ? 'font-semibold text-on-surface' : 'font-medium text-text-secondary md:text-on-surface-variant'}`}>
                      {member.name}
                    </span>
                  </button>
                ))}
                
                {/* Add New Family Member */}
                <button onClick={() => navigate('/patient/family')} className="flex flex-col items-center gap-2 min-w-[72px] group outline-none">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-outline transition-colors group-hover:border-[#005c55] group-hover:text-[#005c55] active:scale-95">
                    <Plus className="w-8 h-8" />
                  </div>
                  <span className="text-[12px] md:text-[14px] font-medium text-text-secondary">Add</span>
                </button>
              </div>
            </section>

          </div>

          {/* Secondary Column: Quick Info Cards */}
          <div className="md:col-span-4 w-full flex flex-row md:flex-col gap-4 md:gap-8">
            
            {/* Last Checkup Card */}
            <Card className="flex-1 md:w-full rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container group hover:border-[#005c55]/30 md:hover:border-outline-variant/30 transition-colors cursor-pointer md:cursor-default">
              <CardContent className="p-4 md:p-6 flex flex-col h-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-1 md:mb-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container md:bg-primary-fixed text-[#005c55] md:text-on-primary-fixed-variant flex items-center justify-center">
                    {window?.innerWidth < 768 ? <ClipboardList className="w-5 h-5" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <h3 className="text-[14px] font-semibold text-on-surface md:text-[20px] md:font-semibold">Last checkup</h3>
                </div>
                
                <div className="md:space-y-4 mt-auto md:mt-0">
                  <div>
                    <p className="hidden md:block text-[12px] font-medium text-text-secondary">Date</p>
                    <p className="text-[12px] md:text-[14px] font-medium md:font-semibold text-text-secondary md:text-on-surface">
                      No recent checkups
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Records Card */}
            <Card className="flex-1 md:w-full rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border border-surface-container group hover:border-[#005c55]/30 md:hover:border-outline-variant/30 transition-colors cursor-pointer md:cursor-default">
              <CardContent className="p-4 md:p-6 flex flex-col h-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-1 md:mb-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container md:bg-secondary-fixed text-[#005c55] md:text-on-secondary-fixed-variant flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 md:w-6 md:h-6 fill-current md:fill-none" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-on-surface md:text-[20px] md:font-semibold">Health records</h3>
                </div>
                
                <div className="mt-auto">
                  <p className="text-[12px] md:text-[14px] font-medium text-text-secondary">
                    Coming soon
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Health Tip Banner */}
        <section className="mt-8 bg-[#ffdbce] md:bg-gradient-to-r md:from-[#005c55] md:to-[#0f766e] text-[#72361b] md:text-white rounded-xl md:rounded-2xl p-4 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 relative overflow-hidden md:shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
          {/* Desktop background decoration */}
          <div className="hidden md:block absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none">
            <Lightbulb className="w-[120px] h-[120px] absolute -right-4 -top-4" />
          </div>
          
          {/* Icon */}
          <div className="w-10 h-10 md:w-auto md:h-auto rounded-full bg-white/40 md:bg-white/20 md:p-4 md:rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm z-10">
            {window?.innerWidth < 768 ? <Lightbulb className="w-5 h-5" /> : <Leaf className="w-9 h-9 fill-current" />}
          </div>
          
          {/* Content */}
          <div className="flex-1 space-y-1 md:space-y-2 z-10 text-left">
            <h5 className="text-[14px] md:text-[20px] font-semibold md:font-bold">
              {window?.innerWidth < 768 ? 'Health Tip' : 'Health Tip of the Day'}
            </h5>
            <p className="text-[12px] md:text-[18px] leading-relaxed md:text-primary-fixed opacity-90 md:opacity-100">
              Stay hydrated! Drinking 8 glasses of water a day can improve your concentration and energy levels during the afternoon.
              <span className="hidden md:inline"> Aim for at least 8 glasses of water today to keep your heart working efficiently.</span>
            </p>
          </div>

          {/* Desktop Button */}
          <Button variant="secondary" className="hidden md:inline-flex z-10 bg-white text-[#005c55] hover:bg-secondary-fixed font-semibold px-6 py-6 rounded-xl transition-colors text-[14px]">
            Learn More
          </Button>
        </section>

      </main>

      {/* Footer (Desktop Only) */}
      <footer className="hidden md:block mt-12 py-10 border-t border-outline-variant/20 bg-surface-container-low text-center">
        <p className="text-[12px] font-medium text-text-secondary">
          © 2024 Aeropack Pvt Ltd. All rights reserved. Your privacy is our priority.
        </p>
      </footer>
    </div>
  );
};