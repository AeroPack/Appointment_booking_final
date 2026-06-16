import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
  PlusCircle,
  Save,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useAppSelector } from '@/core/store/hooks';
import { useGetAppointmentSettingsQuery, useUpdateAppointmentSettingsMutation, useGetVenuesQuery } from '@/features/settings/settingsApi';

type Shift = {
  id: string;
  start: string;
  end: string;
  venueId: string;
};

type DaySchedule = {
  day: string;
  short: string;
  active: boolean;
  expanded: boolean;
  shifts: Shift[];
};

const DAY_NAMES: { day: string; short: string }[] = [
  { day: 'Monday', short: 'MON' },
  { day: 'Tuesday', short: 'TUE' },
  { day: 'Wednesday', short: 'WED' },
  { day: 'Thursday', short: 'THU' },
  { day: 'Friday', short: 'FRI' },
  { day: 'Saturday', short: 'SAT' },
  { day: 'Sunday', short: 'SUN' },
];

function timeToDisplay(t: string): string {
  const [h = 0, m = 0] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function displayToTime(s: string): string {
  const match = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return s;
  let h = parseInt(match[1]!);
  const m = match[2]!;
  if (match[3]!.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3]!.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

export function Availability() {
  const authUser = useAppSelector(state => state.auth.user);
  const doctorId = authUser?.id ?? '';

  const { data: settings, isLoading } = useGetAppointmentSettingsQuery(doctorId, { skip: !doctorId });
  const [updateSettings, { isLoading: isSaving }] = useUpdateAppointmentSettingsMutation();
  const { data: venues = [] } = useGetVenuesQuery();
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [slotDuration, setSlotDuration] = useState(15);
  const [maxPatients, setMaxPatients] = useState(10);

  useEffect(() => {
    if (!settings) return;
    const periods = settings.periods;

    const grouped = DAY_NAMES.map((name, idx) => {
      const dayOfWeek = idx + 1;
      const dayPeriods = periods.filter(p => p.day_of_week === dayOfWeek);

      return {
        day: name.day,
        short: name.short,
        active: dayPeriods.length > 0,
        expanded: false,
        shifts: dayPeriods.map((p, i) => ({
          id: `${name.short}-${i}`,
          start: timeToDisplay(p.start_time),
          end: timeToDisplay(p.end_time),
          venueId: p.venue?.id ?? '',
        })),
      };
    });

    setSchedule(grouped);

    if (periods.length > 0) {
      setSlotDuration(periods[0]!.slot_duration_minutes);
      setMaxPatients(periods[0]!.max_patients_per_slot);
    }
  }, [settings]);

  const toggleExpand = (index: number) => {
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, expanded: !d.expanded } : d));
  };

  const toggleActive = (index: number) => {
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, active: !d.active } : d));
  };

  const handleVenueChange = (dayIndex: number, shiftIndex: number, venueId: string) => {
    setSchedule(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d,
      shifts: d.shifts.map((s, j) => j !== shiftIndex ? s : { ...s, venueId }),
    }));
  };

  const handleAddShift = (dayIndex: number) => {
    setSchedule(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d,
      shifts: [...d.shifts, {
        id: `${d.short}-${d.shifts.length}`,
        start: '9:00 AM',
        end: '5:00 PM',
        venueId: venues[0]?.id ?? '',
      }],
    }));
  };

  const handleDeleteShift = (dayIndex: number, shiftIndex: number) => {
    setSchedule(prev => prev.map((d, i) => i !== dayIndex ? d : {
      ...d,
      shifts: d.shifts.filter((_, j) => j !== shiftIndex),
    }));
  };

  const handleSave = async () => {
    if (!doctorId) return;
    const periods = schedule.flatMap((day, idx) => {
      if (!day.active) return [];
      return day.shifts.map(s => ({
        day_of_week: idx + 1,
        start_time: displayToTime(s.start),
        end_time: displayToTime(s.end),
        venue_id: s.venueId || undefined,
        slot_duration_minutes: slotDuration,
        max_patients_per_slot: maxPatients,
      }));
    });

    await updateSettings({
      doctor_id: doctorId,
      periods,
      reminders: [],
    });
  };

  const renderTimeInput = (value: string) => (
    <div className="relative">
      <input
        type="text"
        readOnly
        value={value}
        className="w-full h-[48px] pl-4 pr-10 bg-[#f2f4f6] md:bg-white border border-[#bdc9c6] rounded-lg text-[#191c1e] text-[16px] focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none cursor-pointer"
      />
      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#191c1e] pointer-events-none" />
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] font-body-base antialiased pb-[120px] md:pb-12">


      <main className="max-w-[1000px] mx-auto px-4 md:px-10 py-6 md:py-10">
        {/* GLOBAL SETTINGS */}
        <section className="mb-6 bg-white rounded-xl border border-[#eceef0] p-4 md:p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-3">General Settings</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-[#64748B]">Slot Duration (min)</span>
              <input
                type="number"
                value={slotDuration}
                onChange={(e) => setSlotDuration(Math.max(5, Number(e.target.value)))}
                className="w-24 h-[48px] px-3 bg-white border border-[#bdc9c6] rounded-lg text-[#191c1e] text-[14px] focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-[#64748B]">Max Patients / Slot</span>
              <input
                type="number"
                value={maxPatients}
                onChange={(e) => setMaxPatients(Math.max(1, Number(e.target.value)))}
                className="w-24 h-[48px] px-3 bg-white border border-[#bdc9c6] rounded-lg text-[#191c1e] text-[14px] focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none"
              />
            </div>
          </div>
        </section>

        {/* WEEKLY SCHEDULE GRID */}
        <section className="space-y-4">
          <h2 className="md:hidden text-[12px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Weekly Availability</h2>

          {/* Main Days (Mon-Fri) */}
          {schedule.slice(0, 5).map((dayData, index) => (
            <div key={dayData.day}>

              {/* MOBILE ACCORDION VIEW */}
              <div className="md:hidden bg-white rounded-xl border border-[#eceef0] shadow-sm mb-3">
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-[#f7f9fb] transition-colors"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[14px] font-bold text-[#005c55] w-10 text-left uppercase">{dayData.short}</span>
                  </div>
                  {dayData.expanded ? (
                    <ChevronUp className="w-5 h-5 text-[#6e7977] transition-transform" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#6e7977] transition-transform" />
                  )}
                </button>

                {dayData.expanded && (
                  <div className="p-4 pt-0 flex flex-col gap-4 bg-white">
                    <div className="h-[1px] bg-[#eceef0] w-full" />

                    {dayData.active && dayData.shifts.length > 0 ? (
                      dayData.shifts.map((shift, shiftIndex) => (
                        <div key={shift.id} className="flex flex-col gap-3 relative">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[12px] font-medium text-[#64748B]">Start</span>
                              {renderTimeInput(shift.start)}
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[12px] font-medium text-[#64748B]">End</span>
                              {renderTimeInput(shift.end)}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[12px] font-medium text-[#64748B]">Venue</span>
                            <div className="relative">
                               <select
                                 value={shift.venueId}
                                 onChange={(e) => handleVenueChange(index, shiftIndex, e.target.value)}
                                 className="w-full h-[48px] px-3 pr-10 bg-[#f2f4f6] border border-[#bdc9c6] rounded-lg text-[#191c1e] appearance-none focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none"
                               >
                                  <option value="">Select venue</option>
                                  {venues.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                  ))}
                               </select>
                               <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e7977] pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button onClick={() => handleDeleteShift(index, shiftIndex)} className="text-[#DC2626] hover:bg-[#ffdad6] p-2 rounded-lg transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="italic text-[#64748B] text-[14px] py-2 text-center">Not accepting appointments on this day.</div>
                    )}

                    {dayData.active && (
                      <button onClick={() => handleAddShift(index)} className="flex items-center gap-2 text-[#005c55] font-semibold text-[14px] mt-2 py-2 hover:bg-[#f2f4f6] rounded-lg transition-colors w-fit px-2">
                        <PlusCircle className="w-5 h-5" /> Add period
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* DESKTOP BENTO VIEW */}
              <div className={`hidden md:flex bg-white rounded-xl border border-[#bdc9c6] overflow-hidden transition-all shadow-sm mb-4 ${!dayData.active ? 'bg-[#f8fafc]' : ''}`}>
                <div className={`w-[200px] p-6 border-r border-[#bdc9c6] flex flex-col justify-between shrink-0 ${!dayData.active ? 'bg-[#f8fafc]' : 'bg-[#f8fafc]'}`}>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0F172A]">{dayData.day}</h3>
                    <div className={`inline-flex px-3 py-1 mt-2 rounded-full text-[12px] font-semibold ${dayData.active ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#e2e8f0] text-[#64748B]'}`}>
                      {dayData.active ? 'Active' : 'Unavailable'}
                    </div>
                  </div>
                  <div className="mt-6">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={dayData.active} onChange={() => toggleActive(index)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-[#d8dadc] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#005c55]"></div>
                    </label>
                  </div>
                </div>

                <div className="flex-1 p-6">
                  {!dayData.active ? (
                    <div className="h-full flex items-center justify-center italic text-[#64748B] text-[16px]">
                      Not accepting appointments on this day.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dayData.shifts.map((shift, shiftIndex) => (
                        <div key={shift.id} className="flex gap-4 items-end">
                          <div className="flex flex-col gap-1 w-36">
                            {shiftIndex === 0 && <span className="text-[12px] font-medium text-[#64748B]">Start Time</span>}
                            {renderTimeInput(shift.start)}
                          </div>
                          <div className="flex flex-col gap-1 w-36">
                            {shiftIndex === 0 && <span className="text-[12px] font-medium text-[#64748B]">End Time</span>}
                            {renderTimeInput(shift.end)}
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            {shiftIndex === 0 && <span className="text-[12px] font-medium text-[#64748B]">Venue</span>}
                            <div className="relative">
                               <select
                                 value={shift.venueId}
                                 onChange={(e) => handleVenueChange(index, shiftIndex, e.target.value)}
                                 className="w-full h-[48px] px-4 pr-10 bg-white border border-[#bdc9c6] rounded-lg text-[#191c1e] text-[14px] appearance-none focus:border-[#005c55] focus:ring-1 focus:ring-[#005c55] outline-none cursor-pointer"
                               >
                                  <option value="">Select venue</option>
                                  {venues.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                  ))}
                               </select>
                               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e7977] pointer-events-none" />
                            </div>
                          </div>
                          <button onClick={() => handleDeleteShift(index, shiftIndex)} className="w-[48px] h-[48px] flex items-center justify-center text-[#DC2626] hover:bg-[#ffdad6] rounded-lg transition-colors shrink-0">
                             <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => handleAddShift(index)} className="flex items-center gap-2 text-[#005c55] font-semibold text-[14px] mt-4 hover:underline py-2">
                         <PlusCircle className="w-5 h-5" /> Add period
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ))}

          {/* Weekend Cluster (Sat-Sun) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-2 md:mt-4">
            {schedule.slice(5, 7).map((dayData, index) => (
              <div key={dayData.day}>

                {/* Mobile Weekend Accordion */}
                <div className="md:hidden bg-white rounded-xl border border-[#eceef0] shadow-sm">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-[#f7f9fb] transition-colors"
                    onClick={() => toggleExpand(index + 5)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[14px] font-bold text-[#005c55] w-10 text-left uppercase">{dayData.short}</span>
                      <span className="text-[12px] text-[#64748B] italic">No shifts set</span>
                    </div>
                    {dayData.expanded ? (
                      <ChevronUp className="w-5 h-5 text-[#6e7977] transition-transform" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#6e7977] transition-transform" />
                    )}
                  </button>
                  {dayData.expanded && (
                    <div className="p-4 pt-0 bg-white">
                      <div className="h-[1px] bg-[#eceef0] w-full mb-4" />
                      <div className="italic text-[#64748B] text-[14px] py-2 text-center">Not accepting appointments on this day.</div>
                    </div>
                  )}
                </div>

                {/* Desktop Weekend Compact Card */}
                <div className="hidden md:flex bg-[#f8fafc] rounded-xl border border-[#bdc9c6] p-6 justify-between items-center opacity-80 shadow-sm">
                  <div>
                    <h4 className="font-bold text-[#0F172A] text-[16px]">{dayData.day}</h4>
                    <span className="text-[12px] font-medium text-[#64748B]">Unavailable</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={dayData.active} onChange={() => toggleActive(index + 5)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[#d8dadc] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#005c55]"></div>
                  </label>
                </div>

              </div>
            ))}
          </div>

        </section>
      </main>

      {/* MOBILE FIXED BOTTOM ACTIONS */}

      {/* Mobile Save Button */}
      <div className="md:hidden fixed bottom-[90px] left-0 w-full px-4 z-40">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-[52px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full font-bold text-[16px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Desktop Save Button */}
      <div className="hidden md:fixed md:flex bottom-8 right-8 z-40">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 h-[52px] bg-[#005c55] hover:bg-[#0f766e] text-white rounded-full font-bold text-[16px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

    </div>
  );
}
