import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CalendarDays,
  CheckCircle2,
  UserX,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  FileText,
  History,
  Bell,
  Plus,
  Calendar
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Avatar, AvatarFallback } from '@/core/components/ui/avatar';
import { useGetDoctorStatsQuery, useGetTodayPatientsQuery } from '@/features/doctors/doctorDashboardApi';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function todayLabel(): string {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const date = now.getDate();
  const year = now.getFullYear();
  return `${day}, ${date} ${month} ${year}`;
}

function todayISO(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  if (dateStr === todayISO()) return `Today — ${todayLabel()}`;
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const date = d.getDate();
  const year = d.getFullYear();
  return `${day}, ${date} ${month} ${year}`;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'booked':
      return 'bg-[#6df5e1]/40 text-[#006b5f]';
    case 'finished':
      return 'bg-[#16A34A]/15 text-[#16A34A]';
    case 'no_show':
      return 'bg-[#ffdad6] text-[#DC2626]';
    case 'cancelled':
      return 'bg-[#eceef0] text-[#3e4947]';
    default:
      return 'bg-[#eceef0] text-[#3e4947]';
  }
};

const statusDisplay = (status: string) => {
  switch (status) {
    case 'booked': return 'WAITING';
    case 'finished': return 'FINISHED';
    case 'no_show': return 'NO-SHOW';
    case 'cancelled': return 'CANCELLED';
    default: return status.toUpperCase();
  }
};

export function Dashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const { data: stats, isLoading: statsLoading, error: statsError } = useGetDoctorStatsQuery({ date: selectedDate });
  const { data: patients, isLoading: patientsLoading, error: patientsError } = useGetTodayPatientsQuery({ date: selectedDate });

  const authError = statsError || patientsError;

  const displayDate = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);
  const isToday = selectedDate === todayISO();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    }
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  const statsData = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Patients', mobileLabel: 'Total', value: String(stats.total_patients), mValue: String(stats.total_patients), icon: Users, color: 'text-[#005c55]', bg: 'bg-[#0f766e]/10', showTrend: false },
      { label: 'Booked', mobileLabel: 'Booked', value: String(stats.booked), mValue: String(stats.booked), icon: CalendarDays, color: 'text-[#006b5f]', bg: 'bg-[#6df5e1]/30' },
      { label: 'Finished', mobileLabel: 'Finished', value: String(stats.finished), mValue: String(stats.finished), icon: CheckCircle2, color: 'text-[#16A34A]', bg: 'bg-[#16A34A]/10' },
      { label: 'No-show', mobileLabel: 'No-show', value: String(stats.no_show), mValue: String(stats.no_show), icon: UserX, color: 'text-[#DC2626]', bg: 'bg-[#ffdad6]/50' },
    ];
  }, [stats]);

  const handleRowClick = (id: string) => {
    navigate(`/doctor/appointment/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-body-base antialiased flex flex-col">

      {/* DESKTOP HEADER */}
      <header className="hidden md:flex sticky top-0 z-50 bg-white shadow-sm h-[64px] items-center px-10 justify-between border-b border-[#eceef0]">
        <div className="flex items-center gap-6">
          <h2 className="text-[20px] font-bold text-[#005c55]">{displayDate}</h2>
          <div className="relative" ref={datePickerRef}>
            <Button
              variant="outline"
              className="flex items-center gap-2 border-[#bdc9c6] text-[#0F172A] font-semibold h-9 rounded-lg hover:bg-[#f2f4f6]"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar className="w-4 h-4" /> Change Date
            </Button>
            {showDatePicker && (
              <div className="absolute top-full mt-2 left-0 bg-white border border-[#eceef0] rounded-xl shadow-lg p-4 z-50 flex flex-col gap-3 min-w-[240px]">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
                  className="w-full px-3 py-2 border border-[#bdc9c6] rounded-lg text-[14px] text-[#0F172A] font-medium outline-none focus:ring-2 focus:ring-[#005c55]"
                />
                <div className="flex gap-2">
                  {!isToday && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[13px] font-semibold border-[#bdc9c6]"
                      onClick={() => { setSelectedDate(todayISO()); setShowDatePicker(false); }}
                    >
                      Today
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-[13px] font-semibold border-[#bdc9c6] text-[#64748B]"
                    onClick={() => setShowDatePicker(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#f2f4f6] transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <Button className="bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full h-10 px-6 font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95">
            <Plus className="w-5 h-5" /> Quick Add
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-0 md:px-10 py-0 md:py-8 space-y-6 md:space-y-8">
        {authError && (
          <div className="mx-5 md:mx-0 mb-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
            <span className="font-semibold">Access Error:</span>
            <span>Unable to load dashboard. You must be logged in as a doctor to view this page.</span>
          </div>
        )}

        {/* MOBILE HEADER */}
        <div className="md:hidden flex flex-col px-5 pt-8 pb-2 gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-[28px] font-bold text-[#005c55] leading-tight">Patient Queue</h1>
              <div className="flex items-center gap-2 mt-1 text-[#64748B]">
                <span className="text-[14px] font-medium">{displayDate}</span>
                <button onClick={() => setShowDatePicker(!showDatePicker)}>
                  <Calendar className="w-4 h-4" />
                </button>
                {showDatePicker && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDatePicker(false)}>
                    <div className="bg-white rounded-xl p-4 shadow-lg flex flex-col gap-3 min-w-[280px]" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
                        className="w-full px-3 py-2 border border-[#bdc9c6] rounded-lg text-[16px] text-[#0F172A] font-medium outline-none focus:ring-2 focus:ring-[#005c55]"
                      />
                      <div className="flex gap-2">
                        {!isToday && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-[13px] font-semibold border-[#bdc9c6]"
                            onClick={() => { setSelectedDate(todayISO()); setShowDatePicker(false); }}
                          >
                            Today
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-[13px] font-semibold border-[#bdc9c6] text-[#64748B]"
                          onClick={() => setShowDatePicker(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-[#eceef0] text-[#005c55] active:bg-[#f2f4f6] transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 h-10 px-3 bg-white shadow-sm border border-[#eceef0] rounded-xl">
                <span className="text-[14px] font-semibold text-[#191c1e]">Sort by Token</span>
                <ChevronDown className="w-4 h-4 text-[#64748B]" />
              </div>
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 px-5 md:px-0">
          {statsLoading ? (
            <div className="col-span-full flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            statsData.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <Card key={idx} className="rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-[#eceef0] hover:border-[#bdc9c6] transition-colors cursor-default">
                  <CardContent className="p-4 md:p-6 flex flex-col md:flex-col-reverse justify-between gap-2 md:gap-4 h-full">

                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="text-[12px] md:text-[14px] font-semibold text-[#64748B] uppercase tracking-wider">
                        <span className="md:hidden">{stat.mobileLabel}</span>
                        <span className="hidden md:inline">{stat.label}</span>
                      </p>
                    </div>

                    <div className="flex items-end justify-between w-full">
                      <span className={`text-[28px] md:text-[32px] font-bold leading-none ${stat.color === 'text-[#005c55]' ? 'text-[#0F172A]' : stat.color}`}>
                        {stat.value}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        {/* QUEUE TABLE / LIST */}
        <section className="bg-white md:rounded-xl md:shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] border-t md:border border-[#eceef0] overflow-hidden flex flex-col">

          {/* Desktop Table Header */}
          <div className="hidden md:flex px-6 py-5 border-b border-[#eceef0] justify-between items-center bg-white">
            <h3 className="text-[20px] font-bold text-[#0F172A]">Patient Queue</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <select className="h-10 pl-4 pr-10 rounded-lg border border-[#bdc9c6] bg-[#f2f4f6] text-[#0F172A] font-semibold text-[14px] appearance-none outline-none focus:ring-2 focus:ring-[#005c55] cursor-pointer">
                  <option>Sort by Token #</option>
                  <option>Sort by Time</option>
                  <option>Sort by Status</option>
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-5 h-5 text-[#64748B] pointer-events-none" />
              </div>
              <div className="h-8 w-[1px] bg-[#bdc9c6]/50" />
              <span className="text-[14px] font-medium text-[#64748B]">
                Showing {patients?.length ?? 0} patients
              </span>
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[70px_1fr_90px] md:grid-cols-[80px_2fr_1fr_1fr_1fr_120px_100px] gap-4 px-5 md:px-6 py-3 md:py-4 bg-[#f2f4f6] border-b border-[#eceef0]">
            <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Token #</span>
            <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">
              <span className="md:hidden">Patient Details</span>
              <span className="hidden md:inline">Patient Name</span>
            </span>
            <span className="hidden md:inline text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Venue</span>
            <span className="hidden md:inline text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Date</span>
            <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Slot Time</span>
            <span className="hidden md:inline text-[12px] font-bold text-[#64748B] uppercase tracking-wider">Status</span>
            <span className="hidden md:inline text-[12px] font-bold text-[#64748B] uppercase tracking-wider text-right">Actions</span>
          </div>

          {/* List Rows */}
          {patientsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !patients || patients.length === 0 ? (
            <div className="text-center py-20 text-[#64748B]">
              <p className="text-[18px] font-semibold text-[#0F172A] mb-1">No patients{isToday ? ' today' : ''}</p>
              <p className="text-[14px]">There are no appointments scheduled for {isToday ? 'today' : 'this date'}.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {patients.map((p) => {
                const dt = new Date(p.scheduled_start);
                const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const date = dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                const isFinished = p.appointment_status === 'finished';
                return (
                  <div
                    key={p.id}
                    onClick={() => handleRowClick(p.id)}
                    className={`grid grid-cols-[70px_1fr_90px] md:grid-cols-[80px_2fr_1fr_1fr_1fr_120px_100px] gap-4 px-5 md:px-6 py-4 md:py-5 border-b border-[#eceef0] items-center transition-colors cursor-pointer group hover:bg-[#f7f9fb]`}
                  >
                    {/* Token # */}
                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg font-bold flex items-center justify-center text-[14px] md:text-[16px] shrink-0 ${isFinished ? 'bg-[#f2f4f6] text-[#64748B]' : 'bg-[#9cf2e8]/30 text-[#005c55]'}`}>
                      {String(p.token_number).padStart(3, '0')}
                    </div>

                    {/* Patient Name */}
                    <div className={`flex items-center gap-3 overflow-hidden ${isFinished ? 'opacity-60' : ''}`}>
                      <Avatar className="hidden md:flex w-9 h-9 rounded-full bg-[#eceef0] items-center justify-center border-0 shrink-0">
                        <AvatarFallback className="text-[#3e4947] font-semibold text-[12px]">{getInitials(p.patient_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-[15px] md:text-[16px] text-[#0F172A] truncate">{p.patient_name}</p>
                        <div className="md:hidden flex items-center gap-1 text-[12px] text-[#64748B] mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{p.venue_name || 'No venue'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Venue (Desktop) */}
                    <div className={`hidden md:block text-[15px] text-[#3e4947] ${isFinished ? 'opacity-60' : ''}`}>
                      {p.venue_name || '—'}
                    </div>

                    {/* Date (Desktop) */}
                    <div className={`hidden md:flex items-center gap-1.5 ${isFinished ? 'opacity-60' : ''}`}>
                      <span className="text-[15px] font-bold text-[#191c1e]">{date}</span>
                    </div>

                    {/* Slot Time */}
                    <div className={`flex items-center gap-1.5 md:gap-2 ${isFinished ? 'opacity-60' : ''}`}>
                      <Clock className="hidden md:block w-4 h-4 text-[#005c55]" />
                      <span className="text-[13px] md:text-[15px] font-bold text-[#191c1e]">
                        <span className="md:hidden mr-1">{date}</span>
                        {time}
                      </span>
                    </div>

                    {/* Status (Desktop) */}
                    <div className="hidden md:flex">
                      <Badge className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border-0 ${getStatusBadge(p.appointment_status)}`}>
                        {statusDisplay(p.appointment_status)}
                      </Badge>
                    </div>

                    {/* Actions (Desktop) */}
                    <div className="hidden md:flex items-center justify-end gap-2">
                      <button className="p-2 text-[#005c55] hover:bg-[#0f766e]/10 rounded-lg transition-colors active:scale-95">
                        <FileText className="w-5 h-5" />
                      </button>
                      {isFinished ? (
                        <button className="p-2 text-[#3e4947] hover:bg-[#eceef0] rounded-lg transition-colors active:scale-95">
                          <History className="w-5 h-5" />
                        </button>
                      ) : (
                        <button className="p-2 text-[#16A34A] hover:bg-[#16A34A]/10 rounded-lg transition-colors active:scale-95">
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-5 md:px-6 py-4 bg-[#f2f4f6] md:bg-[#f7f9fb] border-t border-[#eceef0]">
            <span className="text-[13px] font-medium text-[#64748B]">
              Showing {patients?.length ?? 0} patient{patients?.length !== 1 ? 's' : ''}{isToday ? ' today' : ''}
            </span>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="w-8 h-8 md:w-auto md:px-4 md:h-10 text-[#64748B] border-[#bdc9c6] hover:bg-[#eceef0] md:opacity-50">
                <ChevronLeft className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline font-bold">Previous</span>
              </Button>

              <div className="flex items-center gap-1">
                <button className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[#005c55] text-white font-bold text-[14px]">1</button>
              </div>

              <Button variant="outline" size="icon" className="w-8 h-8 md:w-auto md:px-4 md:h-10 text-[#005c55] border-[#005c55] md:border-[#bdc9c6] md:text-[#3e4947] hover:bg-[#005c55]/5 md:hover:bg-[#eceef0]">
                <span className="hidden md:inline font-bold">Next</span>
                <ChevronRight className="w-4 h-4 md:ml-1" />
              </Button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
