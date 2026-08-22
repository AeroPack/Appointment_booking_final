import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  Coffee,
  Info,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useGetMeQuery } from "@/features/users/usersApi";
import { useGetDoctorPatientsQuery } from "@/features/doctors/doctorDashboardApi";
import { useGetAppointmentSettingsQuery } from "@/features/settings/settingsApi";
import { AddAppointmentModal } from "@/features/appointments/AddAppointmentModal";
import type { AppointmentType, EditAppointmentData } from "@/features/appointments/AddAppointmentModal";
import { APPT_CONFIG } from "@/features/appointments/AddAppointmentModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewType = "month" | "week" | "day";

interface Appointment {
  id: string;
  time: string;
  endTime: string;
  patient: string;
  type: AppointmentType;
  patientId?: string;
  scheduledStart?: string;
  phone?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime12(time: string) {
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface Period {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DEFAULT_DAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function jsDayToApiDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function computeHoursForDate(periods: Period[], date: Date): number[] {
  const apiDay = jsDayToApiDay(date.getDay());
  const dayPeriods = periods.filter((p) => p.day_of_week === apiDay);
  if (dayPeriods.length === 0) return DEFAULT_DAY_HOURS;

  let minHour = 24;
  let maxHour = 0;
  for (const p of dayPeriods) {
    const startH = parseInt(p.start_time.split(":")[0] ?? "0", 10);
    const endH = parseInt(p.end_time.split(":")[0] ?? "0", 10);
    if (startH < minHour) minHour = startH;
    if (endH > maxHour) maxHour = endH;
  }

  if (minHour >= maxHour) return DEFAULT_DAY_HOURS;

  const hours: number[] = [];
  for (let h = minHour; h < maxHour; h++) hours.push(h);
  return hours;
}

function computeWeekHours(periods: Period[], weekStart: Date): number[] {
  const allHours = new Set<number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    for (const h of computeHoursForDate(periods, d)) allHours.add(h);
  }
  const sorted = Array.from(allHours).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : DEFAULT_DAY_HOURS;
}

function isHourInGap(periods: Period[], date: Date, hour: number): boolean {
  const apiDay = jsDayToApiDay(date.getDay());
  const dayPeriods = periods.filter((p) => p.day_of_week === apiDay);
  if (dayPeriods.length === 0) return false;
  for (const p of dayPeriods) {
    const startH = parseInt(p.start_time.split(":")[0] ?? "0", 10);
    const endH = parseInt(p.end_time.split(":")[0] ?? "0", 10);
    if (hour >= startH && hour < endH) return false;
  }
  return true;
}

// ─── View Switcher ────────────────────────────────────────────────────────────

function ViewSwitcher({ view, setView }: { view: ViewType; setView: (v: ViewType) => void }) {
  return (
    <div className="flex bg-muted rounded-lg p-0.5 shrink-0">
      {(["day", "week", "month"] as ViewType[]).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
            view === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Calendar Header ──────────────────────────────────────────────────────────

interface CalendarHeaderProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAddAppointment: () => void;
  doctorName: string;
  speciality: string;
}

function CalendarHeader({ view, setView, label, onPrev, onNext, onToday, onAddAppointment, doctorName, speciality }: CalendarHeaderProps) {
  return (
    <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Doctor Schedule</h2>
          <p className="text-sm text-muted-foreground">{doctorName} · {speciality}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted rounded-lg px-1 py-1">
            <button
              onClick={onPrev}
              aria-label="Previous"
              className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium text-sm min-w-[100px] sm:min-w-[130px] text-center select-none px-1">
              {label}
            </span>
            <button
              onClick={onNext}
              aria-label="Next"
              className="p-1.5 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={onToday} className="shrink-0">
            Today
          </Button>

          <ViewSwitcher view={view} setView={setView} />

          <Button size="sm" className="gap-1.5 shrink-0" onClick={onAddAppointment}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Booking</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ─── Color Legend ─────────────────────────────────────────────────────────────

function ColorLegend({ selectedType, onSelectType }: { selectedType: AppointmentType | null; onSelectType: (t: AppointmentType | null) => void }) {
  return (
    <div className="flex items-center gap-x-3 gap-y-1.5 px-4 sm:px-6 py-2 bg-muted/40 border-b border-border flex-wrap">
      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium shrink-0">
        <Info className="h-3 w-3" /> Filter:
      </span>
      <button
        onClick={() => onSelectType(null)}
        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
          selectedType === null
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        All
      </button>
      {Object.entries(APPT_CONFIG).map(([key, cfg]) => {
        const isSelected = selectedType === key;
        return (
          <button
            key={key}
            onClick={() => onSelectType(isSelected ? null : key as AppointmentType)}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
              isSelected
                ? "bg-foreground text-background"
                : `${cfg.pill} hover:opacity-80`
            }`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Appointment Pill (month cell) ────────────────────────────────────────────

function ApptPill({ appt }: { appt: Appointment }) {
  const cfg = APPT_CONFIG[appt.type];
  return (
    <div className={`text-[10px] sm:text-[11px] rounded-sm px-1 py-px sm:px-1.5 truncate font-medium border-l-2 ${cfg.pill} ${cfg.bar}`}>
      <span className="hidden sm:inline">{formatTime12(appt.time)} · </span>
      {appt.patient}
    </div>
  );
}

// ─── Appointment Card (day / week views) ─────────────────────────────────────

function ApptCard({ appt, compact = false, onClick }: { appt: Appointment; compact?: boolean; onClick?: () => void }) {
  const cfg = APPT_CONFIG[appt.type];
  const Icon = cfg.icon;
  return (
    <div
      className={`rounded-lg border-l-4 p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer w-full ${cfg.card} ${cfg.bar}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className={`font-semibold text-sm truncate ${cfg.text}`}>{appt.patient}</div>
          {!compact && (
            <div className={`flex items-center gap-1 text-xs mt-0.5 opacity-80 ${cfg.text}`}>
              <Icon className="h-3 w-3 shrink-0" />
              {cfg.label}
            </div>
          )}
        </div>
        <span className={`text-xs shrink-0 opacity-75 ${cfg.text}`}>
          {formatTime12(appt.time)}
        </span>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  setCurrentDate,
  setView,
  appointments,
}: {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  setView: (v: ViewType) => void;
  appointments: Record<string, Appointment[]>;
}) {
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const result: Array<{ day: number; key: string; isCurrentMonth: boolean; isToday: boolean }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      result.push({ day: d, key: toDateKey(year, month - 1, d), isCurrentMonth: false, isToday: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const k = toDateKey(year, month, d);
      result.push({ day: d, key: k, isCurrentMonth: true, isToday: isSameDay(new Date(year, month, d), today) });
    }
    const remaining = result.length <= 35 ? 35 - result.length : 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      result.push({ day: d, key: toDateKey(year, month + 1, d), isCurrentMonth: false, isToday: false });
    }
    return result;
  }, [year, month]);

  const rows = cells.length / 7;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/30 border-b border-border shrink-0">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      <div
        className="flex-1 grid grid-cols-7 divide-x divide-y divide-border overflow-hidden"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells.map((cell) => {
          const appts = appointments[cell.key] ?? [];
          const maxShow = 2;
          const extra = appts.length - maxShow;

          return (
            <div
              key={cell.key}
              role={cell.isCurrentMonth ? "button" : undefined}
              tabIndex={cell.isCurrentMonth ? 0 : undefined}
              onClick={() => {
                if (!cell.isCurrentMonth) return;
                setCurrentDate(new Date(year, month, cell.day));
                setView("day");
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && cell.isCurrentMonth) {
                  setCurrentDate(new Date(year, month, cell.day));
                  setView("day");
                }
              }}
               className={`p-0.5 sm:p-1 flex flex-col gap-0 sm:gap-0.5 min-h-[60px] sm:min-h-[90px] transition-colors outline-none group ${
                 !cell.isCurrentMonth
                   ? "bg-muted/20"
                   : cell.isToday
                   ? "bg-primary/5 ring-2 ring-inset ring-primary/20"
                   : "hover:bg-accent/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
               }`}
             >
               <span
                 className={`text-[10px] sm:text-xs font-medium w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full self-end ${
                   cell.isToday
                     ? "bg-primary text-primary-foreground font-bold"
                     : !cell.isCurrentMonth
                     ? "text-muted-foreground/40"
                     : "text-foreground"
                 }`}
               >
                 {cell.day}
               </span>

               <div className="flex flex-col gap-0 sm:gap-0.5">
                 {appts.slice(0, maxShow).map((appt) => (
                   <ApptPill key={appt.id} appt={appt} />
                 ))}
                 {extra > 0 && (
                   <span className="text-[10px] sm:text-[11px] text-muted-foreground px-1.5">+{extra} more</span>
                 )}
               </div>

              {cell.isCurrentMonth && appts.length === 0 && (
                <div className="flex-1 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-3 w-3 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ currentDate, appointments, onEditAppointment, selectedType, hours, periods }: { currentDate: Date; appointments: Record<string, Appointment[]>; onEditAppointment: (appt: Appointment) => void; selectedType: AppointmentType | null; hours: number[]; periods: Period[] }) {
  const today = new Date();

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        date: d,
        key: toDateKey(d.getFullYear(), d.getMonth(), d.getDate()),
        isToday: isSameDay(d, today),
        dayName: DAY_NAMES[i],
        dayNum: d.getDate(),
      };
    }),
  [weekStart]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[800px]">
        {/* Day headers */}
        <div className="flex border-b border-border bg-card sticky top-0 z-10">
          <div className="w-12 sm:w-20 shrink-0 border-r border-border" />
          {days.map(({ key, isToday, dayName, dayNum }) => (
            <div
              key={key}
              className={`flex-1 py-2 flex flex-col items-center border-r border-border last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}
            >
              <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {dayName}
              </span>
              <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {dayNum}
              </span>
            </div>
          ))}
        </div>

        {/* Time rows */}
        {hours.map((hour) => {
          const timeLabel = hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`;
          return (
            <div key={hour} className="flex border-b border-border">
              <div className="w-12 sm:w-20 shrink-0 border-r border-border py-3 pr-2 flex justify-end">
                <span className="text-xs text-muted-foreground">{timeLabel}</span>
              </div>
              {days.map(({ date, key, isToday }) => {
                const appts = (appointments[key] ?? []).filter(
                  (a) => parseInt(a.time.split(":")[0] ?? "0") === hour &&
                    (selectedType === null || a.type === selectedType)
                );
                const inGap = isHourInGap(periods, date, hour);
                return (
                  <div
                    key={key}
                    className={`flex-1 min-h-[60px] border-r border-border last:border-r-0 p-1 ${
                      isToday ? "bg-primary/5" : inGap ? "bg-muted/10" : "hover:bg-accent/20 transition-colors"
                    }`}
                  >
                    {inGap && appts.length === 0 && isToday && (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                          <Coffee className="h-3 w-3" /> Break
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {appts.map((appt) => (
                        <ApptCard key={appt.id} appt={appt} compact onClick={() => onEditAppointment(appt)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ currentDate, appointments, onAddAppointment, onEditAppointment, selectedType, hours, periods }: { currentDate: Date; appointments: Record<string, Appointment[]>; onAddAppointment: () => void; onEditAppointment: (appt: Appointment) => void; selectedType: AppointmentType | null; hours: number[]; periods: Period[] }) {
  const today = new Date();
  const key = toDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const allAppts = appointments[key] ?? [];
  const appts = selectedType ? allAppts.filter((a) => a.type === selectedType) : allAppts;
  const isToday = isSameDay(currentDate, today);
  const urgentCount = appts.filter((a) => a.type === "urgent").length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Daily stats banner */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3 bg-card border-b border-border flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {isToday
              ? "Today's schedule"
              : currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">
            {appts.length} appointment{appts.length !== 1 ? "s" : ""}
          </span>
          {urgentCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {urgentCount} urgent
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {appts.length === 0 && hours.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No availability set</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            You have no availability configured for this day. Set your hours in Availability settings.
          </p>
        </div>
      )}

      {/* Empty state - no appointments but has hours */}
      {appts.length === 0 && hours.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No appointments</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            There are no appointments scheduled for this day. Click below to add one.
          </p>
          <Button size="sm" className="gap-1.5" onClick={onAddAppointment}>
            <Plus className="h-4 w-4" /> Add Appointment
          </Button>
        </div>
      )}

      {/* Timeline */}
      {hours.length > 0 && (
        <div className="px-4 sm:px-6 py-4">
          {hours.map((hour) => {
            const timeLabel = hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`;
            const hourAppts = appts.filter((a) => parseInt(a.time.split(":")[0] ?? "0") === hour);
            const inGap = isHourInGap(periods, currentDate, hour);

            return (
              <div key={hour} className="flex gap-3 sm:gap-6 min-h-[64px]">
                <div className="w-16 sm:w-20 shrink-0 pt-1 text-right">
                  <span className="text-xs text-muted-foreground">{timeLabel}</span>
                </div>
                <div
                  className={`flex-1 border-t border-border pb-3 pt-1 ${
                    inGap ? "bg-muted/10" : ""
                  }`}
                >
                  {inGap && hourAppts.length === 0 && (
                    <div className="flex items-center gap-2 py-1">
                      <Coffee className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground/50 font-medium">Break</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {hourAppts.map((appt) => (
                      <ApptCard key={appt.id} appt={appt} onClick={() => onEditAppointment(appt)} />
                    ))}
                  </div>
                  {hourAppts.length === 0 && !inGap && (
                    <button className="w-full text-left group py-1" onClick={onAddAppointment}>
                      <span className="text-xs text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Add appointment
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page Coordinator ────────────────────────────────────────────────────

export const CalendarPage = () => {
  const [view, setView] = useState<ViewType>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editData, setEditData] = useState<EditAppointmentData | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);

  const { data: me } = useGetMeQuery();
  const doctorId = me?.id;

  const { data: settings } = useGetAppointmentSettingsQuery(doctorId!, { skip: !doctorId });
  const periods: Period[] = settings?.periods ?? [];

  const dateRange = useMemo(() => {
    if (view === "week") {
      const ws = new Date(currentDate);
      ws.setDate(currentDate.getDate() - currentDate.getDay());
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      return {
        from: toDateKey(ws.getFullYear(), ws.getMonth(), ws.getDate()),
        to: toDateKey(we.getFullYear(), we.getMonth(), we.getDate()),
      };
    }
    if (view === "month") {
      const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return {
        from: toDateKey(first.getFullYear(), first.getMonth(), first.getDate()),
        to: toDateKey(last.getFullYear(), last.getMonth(), last.getDate()),
      };
    }
    const key = toDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    return { from: key, to: key };
  }, [view, currentDate]);

  const { data: todayPatients, isLoading: loadingPatients } = useGetDoctorPatientsQuery(
    dateRange,
    { skip: !doctorId, refetchOnMountOrArgChange: true, refetchOnFocus: true, pollingInterval: 10000 }
  );

  const appointments = useMemo(() => {
    if (!todayPatients) return {};
    const map: Record<string, Appointment[]> = {};
    for (const p of todayPatients) {
      const raw = p.scheduled_start ?? '';
      const datePart = raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0];
      if (!datePart) continue;
      const timePart = raw.includes('T') ? raw.split('T')[1] : raw.split(' ')[1];
      const appt: Appointment = {
        id: p.id,
        time: timePart?.slice(0, 5) ?? '',
        endTime: "",
        patient: p.patient_name,
        type: (p.appointment_type || 'checkup') as AppointmentType,
        patientId: p.patient_id,
        scheduledStart: p.scheduled_start,
        phone: p.phone ?? undefined,
      };
      if (!map[datePart]) map[datePart] = [];
      map[datePart].push(appt);
    }
    return map;
  }, [todayPatients]);

  const dayHours = useMemo(() => computeHoursForDate(periods, currentDate), [periods, currentDate]);

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  const weekHours = useMemo(() => computeWeekHours(periods, weekStart), [periods, weekStart]);

  const label = useMemo(() => {
    if (view === "month") {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === "week") {
      const ws = new Date(currentDate);
      ws.setDate(currentDate.getDate() - currentDate.getDay());
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      const sm = (MONTH_NAMES[ws.getMonth()] ?? "").slice(0, 3);
      const em = (MONTH_NAMES[we.getMonth()] ?? "").slice(0, 3);
      return ws.getMonth() === we.getMonth()
        ? `${sm} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
        : `${sm} ${ws.getDate()} – ${em} ${we.getDate()}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [view, currentDate]);

  const handleAddAppointment = () => {
    setEditData(undefined);
    setIsAddModalOpen(true);
  };

  const handleEditAppointment = (appt: Appointment) => {
    if (!appt.patientId || !appt.scheduledStart) return;

    const appointmentDate = new Date(appt.scheduledStart);
    const now = new Date();
    if (appointmentDate < now) {
      toast.error("Past bookings cannot be edited");
      return;
    }

    setEditData({
      appointmentId: appt.id,
      date: toDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
      scheduledStart: appt.scheduledStart,
      patientId: appt.patientId,
      patientName: appt.patient,
      patientPhone: appt.phone ?? "",
    });
    setIsAddModalOpen(true);
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <CalendarHeader
        view={view}
        setView={setView}
        label={label}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={() => setCurrentDate(new Date())}
        onAddAppointment={handleAddAppointment}
        doctorName={me?.name ?? "Doctor"}
        speciality={me?.speciality ?? "General Practice"}
      />

      <ColorLegend selectedType={selectedType} onSelectType={setSelectedType} />

      <div className="flex-1 overflow-hidden flex flex-col bg-background">
        {loadingPatients && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        {!loadingPatients && (
          <>
            {view === "month" && (
              <MonthView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                setView={setView}
                appointments={appointments}
              />
            )}
            {view === "week" && <WeekView currentDate={currentDate} appointments={appointments} onEditAppointment={handleEditAppointment} selectedType={selectedType} hours={weekHours} periods={periods} />}
            {view === "day" && <DayView currentDate={currentDate} appointments={appointments} onAddAppointment={handleAddAppointment} onEditAppointment={handleEditAppointment} selectedType={selectedType} hours={dayHours} periods={periods} />}
          </>
        )}
      </div>
      {isAddModalOpen && (
        <AddAppointmentModal
          onClose={() => setIsAddModalOpen(false)}
          defaultDate={currentDate}
          doctorId={doctorId}
          editData={editData}
        />
      )}
    </div>
  );
};
