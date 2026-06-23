import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
  Plus,
  Save,
  Info,
  Copy,
  AlertTriangle,
  CalendarClock,
  Loader2,
  MapPin,
  MoreVertical,
  Pencil,
  Check,
  X
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { useAppSelector } from "@/core/store/hooks";
import {
  useGetAppointmentSettingsQuery,
  useUpdateAppointmentSettingsMutation,
  useGetVenuesQuery,
} from "@/features/settings/settingsApi";
import { useCreateVenueMutation, useUpdateVenueMutation } from "@/features/doctors/venuesApi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Shift {
  id: string;
  start: string; // HH:MM (24h)
  end: string; // HH:MM (24h)
}

interface DaySchedule {
  dayOfWeek: number; // 1 = Mon … 7 = Sun
  day: string;
  short: string;
  active: boolean;
  shifts: Shift[];
}

interface VenueSchedule {
  venueId: string;
  venueName: string;
  expanded: boolean;
  isActive: boolean;
  days: DaySchedule[];
}

type CopyTarget = "weekdays" | "all";

const DAY_NAMES: { day: string; short: string }[] = [
  { day: "Monday", short: "Mon" },
  { day: "Tuesday", short: "Tue" },
  { day: "Wednesday", short: "Wed" },
  { day: "Thursday", short: "Thu" },
  { day: "Friday", short: "Fri" },
  { day: "Saturday", short: "Sat" },
  { day: "Sunday", short: "Sun" },
];

const DEFAULT_SHIFT = { start: "09:00", end: "17:00" };
const SLOT_PRESETS = [5, 10, 15, 20, 30, 45, 60];

// ─── Time helpers ───────────────────────────────────────────────────────────

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTime12(t: string): string {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function countSlots(start: string, end: string, durationMin: number): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0 || durationMin <= 0) return 0;
  return Math.floor(diff / durationMin);
}

/** Returns a validation message for a shift, or null when valid. */
function shiftError(shift: Shift, shifts: Shift[], index: number): string | null {
  const s = timeToMinutes(shift.start);
  const e = timeToMinutes(shift.end);
  if (e <= s) return "End time must be after start time";
  for (let i = 0; i < shifts.length; i++) {
    if (i === index) continue;
    const other = shifts[i]!;
    const os = timeToMinutes(other.start);
    const oe = timeToMinutes(other.end);
    if (oe <= os) continue;
    if (s < oe && os < e) return "Overlaps another shift";
  }
  return null;
}

// ─── Day Row ──────────────────────────────────────────────────────────────────

interface DayRowProps {
  day: DaySchedule;
  slotDuration: number;
  maxPatients: number;
  onToggleActive: () => void;
  onAddShift: () => void;
  onDeleteShift: (shiftIndex: number) => void;
  onUpdateShift: (shiftIndex: number, field: "start" | "end", value: string) => void;
  onCopy: (target: CopyTarget) => void;
}

function DayRow({
  day,
  slotDuration,
  maxPatients,
  onToggleActive,
  onAddShift,
  onDeleteShift,
  onUpdateShift,
  onCopy,
}: DayRowProps) {
  const [copyOpen, setCopyOpen] = useState(false);

  const dayTotalSlots = day.shifts.reduce(
    (sum, s) => sum + countSlots(s.start, s.end, slotDuration),
    0
  );

  return (
    <div
      className={`rounded-xl border transition-colors ${
        day.active ? "border-border bg-card" : "border-border bg-muted/30"
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <Switch checked={day.active} onCheckedChange={onToggleActive} aria-label={`Toggle ${day.day}`} />
          <div className="min-w-0">
            <p className={`font-semibold text-sm ${day.active ? "text-foreground" : "text-muted-foreground"}`}>
              {day.day}
            </p>
            <p className="text-xs text-muted-foreground">
              {day.active
                ? dayTotalSlots > 0
                  ? `${dayTotalSlots} slots/day`
                  : "Add a shift"
                : "Closed"}
            </p>
          </div>
        </div>

        {day.active && day.shifts.length > 0 && (
          <div className="relative shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setCopyOpen((o) => !o)}
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Copy</span>
            </Button>
            {copyOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCopyOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    onClick={() => {
                      onCopy("weekdays");
                      setCopyOpen(false);
                    }}
                  >
                    Copy to weekdays
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    onClick={() => {
                      onCopy("all");
                      setCopyOpen(false);
                    }}
                  >
                    Copy to all days
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Shifts */}
      {day.active && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex flex-col gap-3 border-t border-border pt-3">
          {day.shifts.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No shifts yet — add one below.</p>
          )}

          {day.shifts.map((shift, shiftIndex) => {
            const error = shiftError(shift, day.shifts, shiftIndex);
            const slots = countSlots(shift.start, shift.end, slotDuration);
            return (
              <div key={shift.id} className="flex flex-col gap-1.5">
                <div className="flex items-end gap-2 sm:gap-3">
                  <label className="flex-1 flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Start</span>
                    <input
                      type="time"
                      value={shift.start}
                      onChange={(e) => onUpdateShift(shiftIndex, "start", e.target.value)}
                      className={`h-10 px-3 rounded-md border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring ${
                        error ? "border-red-400" : "border-input"
                      }`}
                    />
                  </label>
                  <label className="flex-1 flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">End</span>
                    <input
                      type="time"
                      value={shift.end}
                      onChange={(e) => onUpdateShift(shiftIndex, "end", e.target.value)}
                      className={`h-10 px-3 rounded-md border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring ${
                        error ? "border-red-400" : "border-input"
                      }`}
                    />
                  </label>
                  <button
                    onClick={() => onDeleteShift(shiftIndex)}
                    aria-label="Remove shift"
                    className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {error ? (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formatTime12(shift.start)} – {formatTime12(shift.end)} ·{" "}
                    <span className="font-medium text-foreground">{slots} slots</span>
                    {slots > 0 && ` · up to ${slots * maxPatients} patients`}
                  </p>
                )}
              </div>
            );
          })}

          <button
            onClick={onAddShift}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline w-fit"
          >
            <Plus className="h-4 w-4" /> Add shift
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Availability() {
  const authUser = useAppSelector((state) => state.auth.user);
  const doctorId = authUser?.id ?? "";

  const { data: settings, isLoading } = useGetAppointmentSettingsQuery(doctorId, { skip: !doctorId });
  const [updateSettings, { isLoading: isSaving }] = useUpdateAppointmentSettingsMutation();
  const { data: venues = [] } = useGetVenuesQuery();

  const [createVenue] = useCreateVenueMutation();
  const [updateVenue] = useUpdateVenueMutation();

  const [schedule, setSchedule] = useState<VenueSchedule[]>([]);
  const [slotDuration, setSlotDuration] = useState(15);
  const [maxPatients, setMaxPatients] = useState(10);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editVenueName, setEditVenueName] = useState("");
  const [menuOpenVenueId, setMenuOpenVenueId] = useState<string | null>(null);

  useEffect(() => {
    if (!settings || !venues.length) return;
    const periods = settings.periods;

    const newSchedule: VenueSchedule[] = venues.map((venue) => {
      const venuePeriods = periods.filter((p) => p.venue?.id === venue.id);
      const days = DAY_NAMES.map((name, idx) => {
        const dayOfWeek = idx + 1;
        const dayPeriods = venuePeriods.filter((p) => p.day_of_week === dayOfWeek);
        return {
          dayOfWeek,
          day: name.day,
          short: name.short,
          active: dayPeriods.length > 0,
          shifts: dayPeriods.map((p, i) => ({
            id: `${name.short}-${i}`,
            start: normalizeTime(p.start_time),
            end: normalizeTime(p.end_time),
          })),
        };
      });
      const isActive = (venue as any).is_active !== false;
      return { venueId: venue.id, venueName: venue.name, expanded: isActive, isActive, days };
    });

    setSchedule(newSchedule);

    if (periods.length > 0) {
      setSlotDuration(periods[0]!.slot_duration_minutes);
      setMaxPatients(periods[0]!.max_patients_per_slot);
    }
  }, [settings, venues]);

  const hasErrors = useMemo(
    () =>
      schedule.some((v) =>
        v.isActive && v.days.some((d) => d.active && d.shifts.some((sh, i) => shiftError(sh, d.shifts, i) !== null))
      ),
    [schedule]
  );

  const toggleVenueExpand = (venueIndex: number) => {
    setSchedule((prev) => prev.map((v, i) => (i === venueIndex ? { ...v, expanded: !v.expanded } : v)));
  };

  const toggleActive = (venueIndex: number, dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((v, i) =>
        i !== venueIndex
          ? v
          : {
              ...v,
              days: v.days.map((d, j) => {
                if (j !== dayIndex) return d;
                const nextActive = !d.active;
                const shifts =
                  nextActive && d.shifts.length === 0
                    ? [{ id: `${d.short}-0`, ...DEFAULT_SHIFT }]
                    : d.shifts;
                return { ...d, active: nextActive, shifts };
              }),
            }
      )
    );
  };

  const handleAddShift = (venueIndex: number, dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((v, i) =>
        i !== venueIndex
          ? v
          : {
              ...v,
              days: v.days.map((d, j) =>
                j !== dayIndex
                  ? d
                  : { ...d, shifts: [...d.shifts, { id: `${d.short}-${Date.now()}`, ...DEFAULT_SHIFT }] }
              ),
            }
      )
    );
  };

  const handleDeleteShift = (venueIndex: number, dayIndex: number, shiftIndex: number) => {
    setSchedule((prev) =>
      prev.map((v, i) =>
        i !== venueIndex
          ? v
          : {
              ...v,
              days: v.days.map((d, j) =>
                j !== dayIndex ? d : { ...d, shifts: d.shifts.filter((_, k) => k !== shiftIndex) }
              ),
            }
      )
    );
  };

  const updateShiftTime = (
    venueIndex: number,
    dayIndex: number,
    shiftIndex: number,
    field: "start" | "end",
    value: string
  ) => {
    setSchedule((prev) =>
      prev.map((v, i) =>
        i !== venueIndex
          ? v
          : {
              ...v,
              days: v.days.map((d, j) =>
                j !== dayIndex
                  ? d
                  : {
                      ...d,
                      shifts: d.shifts.map((s, k) => (k !== shiftIndex ? s : { ...s, [field]: value })),
                    }
              ),
            }
      )
    );
  };

  const copyDayTo = (venueIndex: number, dayIndex: number, target: CopyTarget) => {
    setSchedule((prev) =>
      prev.map((v, i) => {
        if (i !== venueIndex) return v;
        const source = v.days[dayIndex]!;
        return {
          ...v,
          days: v.days.map((d, j) => {
            if (j === dayIndex) return d;
            const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
            if (target === "weekdays" && !isWeekday) return d;
            return {
              ...d,
              active: true,
              shifts: source.shifts.map((s, k) => ({ id: `${d.short}-${k}`, start: s.start, end: s.end })),
            };
          }),
        };
      })
    );
  };

  const handleAddVenue = async () => {
    if (!newVenueName.trim()) return;
    try {
      await createVenue({ name: newVenueName }).unwrap();
      setAddingVenue(false);
      setNewVenueName("");
    } catch {}
  };

  const handleRenameVenue = async (id: string) => {
    if (!editVenueName.trim()) return;
    try {
      await updateVenue({ id, name: editVenueName }).unwrap();
      setEditingVenueId(null);
    } catch {}
  };

  const handleToggleVenueActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateVenue({ id, is_active: !currentStatus }).unwrap();
      setMenuOpenVenueId(null);
    } catch {}
  };

  const handleSave = async () => {
    if (!doctorId || hasErrors) return;
    const periods = schedule.flatMap((venue) => {
      // Omit periods for inactive venues so they are cleared from schedule
      if (!venue.isActive) return [];
      return venue.days.flatMap((day) => {
        if (!day.active) return [];
        return day.shifts.map((s) => ({
          day_of_week: day.dayOfWeek,
          start_time: s.start,
          end_time: s.end,
          venue_id: venue.venueId,
          slot_duration_minutes: slotDuration,
          max_patients_per_slot: maxPatients,
        }));
      });
    });

    try {
      await updateSettings({ doctor_id: doctorId, periods, reminders: [] }).unwrap();
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch {
      // Error surfaced via RTK Query mutation state; keep the user's edits intact.
    }
  };

  if (isLoading || !venues.length) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const saveLabel = isSaving ? "Saving…" : savedAt ? "Saved" : "Save changes";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Availability</h2>
              <p className="text-sm text-muted-foreground">Set your regular weekly clinic hours</p>
            </div>
          </div>
          <div className="hidden sm:block shrink-0">
            <Button onClick={handleSave} disabled={isSaving || hasErrors} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveLabel}
            </Button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
          {/* Onboarding hint */}
          <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="text-foreground font-medium">How scheduling works</p>
              <p>
                Turn on the days you see patients and set your sitting hours (shifts). Each shift is
                split into appointment <span className="font-medium text-foreground">slots</span> of
                the duration below, and each slot can hold your{" "}
                <span className="font-medium text-foreground">max patients</span>. Use{" "}
                <span className="font-medium text-foreground">Copy</span> to reuse a day's hours
                across the week.
              </p>
            </div>
          </div>

          {/* General settings */}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Slot settings</h3>
            <p className="text-xs text-muted-foreground mb-4">Applied to every venue and day.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Slot duration</span>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}
                    className="h-10 w-full pl-9 pr-3 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-ring"
                  >
                    {SLOT_PRESETS.map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-xs text-muted-foreground">How long each appointment lasts.</span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Max patients per slot</span>
                <input
                  type="number"
                  min={1}
                  value={maxPatients}
                  onChange={(e) => setMaxPatients(Math.max(1, Number(e.target.value)))}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">How many patients can book the same slot.</span>
              </label>
            </div>
          </section>

          {/* Venues Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Venues</h3>
            {!addingVenue && (
              <Button variant="outline" size="sm" onClick={() => setAddingVenue(true)} className="gap-1.5 h-8">
                <Plus className="h-4 w-4" /> Add venue
              </Button>
            )}
          </div>

          {addingVenue && (
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              <label className="text-sm font-medium text-foreground">New Venue Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  placeholder="e.g. City Clinic"
                  className="h-10 flex-1 px-3 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => e.key === "Enter" && handleAddVenue()}
                />
                <Button onClick={handleAddVenue} disabled={!newVenueName.trim()} className="gap-1.5 h-10">
                  <Save className="h-4 w-4" /> Save
                </Button>
                <Button variant="ghost" onClick={() => setAddingVenue(false)} className="h-10 px-3">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Venue schedules */}
          {schedule.map((venueData, venueIndex) => {
            const activeCount = venueData.days.filter((d) => d.active).length;
            const isEditing = editingVenueId === venueData.venueId;
            return (
              <section
                key={venueData.venueId}
                className={`rounded-xl border border-border bg-card overflow-hidden transition-opacity ${!venueData.isActive ? "opacity-75" : ""}`}
              >
                <div className="w-full flex items-center justify-between gap-3 p-4 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={editVenueName}
                          onChange={(e) => setEditVenueName(e.target.value)}
                          className="h-8 flex-1 px-2 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameVenue(venueData.venueId);
                            if (e.key === "Escape") setEditingVenueId(null);
                          }}
                        />
                        <button onClick={() => handleRenameVenue(venueData.venueId)} className="text-green-600 hover:text-green-700 p-1 rounded-md hover:bg-green-50">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingVenueId(null)} className="text-red-600 hover:text-red-700 p-1 rounded-md hover:bg-red-50">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground truncate cursor-pointer" onClick={() => toggleVenueExpand(venueIndex)}>
                          {venueData.venueName}
                        </span>
                        {!venueData.isActive && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 uppercase tracking-wider">
                            Inactive
                          </span>
                        )}
                        {venueData.isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditVenueName(venueData.venueName);
                              setEditingVenueId(venueData.venueId);
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                            aria-label="Rename venue"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline-block">
                      {activeCount} {activeCount === 1 ? "day" : "days"} open
                    </span>
                    <button className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" onClick={(e) => {
                      e.stopPropagation();
                      toggleVenueExpand(venueIndex);
                    }}>
                      {venueData.expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                    <div className="relative">
                      <button
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenVenueId((prev) => (prev === venueData.venueId ? null : venueData.venueId));
                        }}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {menuOpenVenueId === venueData.venueId && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpenVenueId(null); }} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-32 rounded-lg border border-border bg-card shadow-lg py-1">
                            <button
                              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleVenueActive(venueData.venueId, venueData.isActive);
                              }}
                            >
                              {venueData.isActive ? "Deactivate" : "Restore"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {venueData.expanded && venueData.isActive && (
                  <div className="px-3 sm:px-4 pb-4 pt-0 flex flex-col gap-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-3">
                      Weekly hours
                    </p>
                    {venueData.days.map((dayData, dayIndex) => (
                      <DayRow
                        key={dayData.day}
                        day={dayData}
                        slotDuration={slotDuration}
                        maxPatients={maxPatients}
                        onToggleActive={() => toggleActive(venueIndex, dayIndex)}
                        onAddShift={() => handleAddShift(venueIndex, dayIndex)}
                        onDeleteShift={(si) => handleDeleteShift(venueIndex, dayIndex, si)}
                        onUpdateShift={(si, field, value) =>
                          updateShiftTime(venueIndex, dayIndex, si, field, value)
                        }
                        onCopy={(target) => copyDayTo(venueIndex, dayIndex, target)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {hasErrors && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Fix the highlighted shifts before saving.
            </p>
          )}
        </div>
      </div>

      {/* Mobile sticky save bar */}
      <div className="sm:hidden border-t border-border bg-card p-3">
        <Button onClick={handleSave} disabled={isSaving || hasErrors} className="w-full h-11 gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
