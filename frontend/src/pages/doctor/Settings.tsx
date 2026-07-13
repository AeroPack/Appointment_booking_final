import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Clock,
  CalendarOff,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Plus,
  Trash2,
  CalendarDays,
  Ban,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertTriangle,
  CalendarClock,
  MapPin,
  MoreVertical,
  Pencil,
  Check,
  Bell,
  FileText,
  Sparkles,
  MessageCircle,
  Key,
  Phone,
  XCircle,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { Input } from "@/core/components/ui/input";
import {
  useGetBookingPoliciesQuery,
  useUpdateBookingPoliciesMutation,
  useGetLeavesQuery,
  useCreateLeaveMutation,
  useDeleteLeaveMutation,
  useGetWhatsAppConfigQuery,
  useUpdateWhatsAppConfigMutation,
} from "@/features/doctors/doctorSettingsApi";
import type { BookingPolicies, DoctorLeave, WhatsAppConfig } from "@/features/doctors/doctorSettingsApi";
import {
  useGetAppointmentSettingsQuery,
  useUpdateAppointmentSettingsMutation,
  useGetVenuesQuery,
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
} from "@/features/settings/settingsApi";
import { useCreateVenueMutation, useUpdateVenueMutation } from "@/features/doctors/venuesApi";
import { useAppSelector } from "@/core/store/hooks";
import type { MessageTemplateRow } from "@/core/types/generated/settings";
import { TemplateCard, type TemplateCategory } from "@/features/settings/TemplateCard";
import { BrowseTemplatesModal } from "@/features/settings/BrowseTemplatesModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTICE_PRESETS = [
  { value: 0, label: "No minimum" },
  { value: 1, label: "1 hour" },
  { value: 2, label: "2 hours" },
  { value: 4, label: "4 hours" },
  { value: 6, label: "6 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
];

const ADVANCE_PRESETS = [
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "1 month" },
  { value: 60, label: "2 months" },
  { value: 90, label: "3 months" },
];

const CANCELLATION_PRESETS = [
  { value: 0, label: "Anytime" },
  { value: 1, label: "1 hour before" },
  { value: 2, label: "2 hours before" },
  { value: 4, label: "4 hours before" },
  { value: 12, label: "12 hours before" },
  { value: 24, label: "24 hours before" },
  { value: 48, label: "48 hours before" },
];

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    key: "reminder_24h",
    label: "24h Reminder",
    description: "Sent exactly 24 hours prior to the appointment slot.",
    template_type: "reminder",
    offset_minutes: 1440,
    icon: Bell,
    color: "text-blue-500",
    placeholders: ["patient_name", "slot_time", "doctor_name", "clinic_name"],
  },
  {
    key: "reminder_6h",
    label: "6h Reminder",
    description: "Sent 6 hours before the appointment.",
    template_type: "reminder",
    offset_minutes: 360,
    icon: Bell,
    color: "text-blue-400",
    placeholders: ["patient_name", "slot_time", "doctor_name", "clinic_name"],
  },
  {
    key: "reminder_1h",
    label: "1h Reminder",
    description: "Short notice reminder before the appointment.",
    template_type: "reminder",
    offset_minutes: 60,
    icon: Zap,
    color: "text-amber-500",
    placeholders: ["patient_name", "slot_time", "doctor_name"],
  },
  {
    key: "cancel",
    label: "Cancellation",
    description: "Triggered when a patient or admin cancels an appointment.",
    template_type: "appointment_cancelled",
    offset_minutes: null,
    icon: XCircle,
    color: "text-red-500",
    placeholders: ["patient_name", "slot_time", "doctor_name", "clinic_name"],
  },
  {
    key: "delay",
    label: "Delay",
    description: "Sent when an appointment is delayed.",
    template_type: "appointment_delayed",
    offset_minutes: null,
    icon: Clock,
    color: "text-orange-500",
    placeholders: ["patient_name", "slot_time", "doctor_name", "clinic_name"],
  },
  {
    key: "reschedule",
    label: "Reschedule",
    description: "Sent when an appointment is rescheduled to a new time.",
    template_type: "appointment_rescheduled",
    offset_minutes: null,
    icon: CalendarClock,
    color: "text-purple-500",
    placeholders: ["patient_name", "slot_time", "doctor_name"],
  },
  {
    key: "on_leave",
    label: "On Leave",
    description: "Sent when the doctor is on leave and appointments are affected.",
    template_type: "doctor_on_leave",
    offset_minutes: null,
    icon: Ban,
    color: "text-gray-500",
    placeholders: ["patient_name", "doctor_name", "clinic_name"],
  },
];

const KNOWN_REMINDER_OFFSETS = new Set(
  TEMPLATE_CATEGORIES.filter((c) => c.template_type === "reminder").map((c) => c.offset_minutes)
);

function formatOffsetMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h before`;
  return `${minutes}m before`;
}

// ─── Availability Types ──────────────────────────────────────────────────────

interface Shift {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  dayOfWeek: number;
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

// ─── Template Helpers ──────────────────────────────────────────────────────

function findTemplate(templates: MessageTemplateRow[] | undefined, type: string, offset?: number): MessageTemplateRow | undefined {
  return templates?.find(t => {
    if (t.template_type !== type) return false;
    if (offset !== undefined) return t.offset_minutes === offset;
    return true;
  });
}

// ─── General Settings Helpers ────────────────────────────────────────────────

function formatDateReadable(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isLeaveInPast(endDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate + "T00:00:00") < today;
}

type SaveStatus = "idle" | "saving" | "success" | "error";
type TabId = "general" | "availability" | "templates";

// ─── Day Row Component ──────────────────────────────────────────────────────

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

      {day.active && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex flex-col gap-3 border-t border-border pt-3">
          {day.shifts.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No shifts yet - add one below.</p>
          )}

          {day.shifts.map((shift, shiftIndex) => {
            const error = shiftError(shift, day.shifts, shiftIndex);
            const slots = countSlots(shift.start, shift.end, slotDuration);
            return (
              <div key={shift.id} className="flex flex-col gap-1.5">
                 <div className="flex flex-col sm:flex-row items-end gap-2 sm:gap-3">
                   <label className="flex-1 flex flex-col gap-1 w-full sm:w-auto">
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
                   <label className="flex-1 flex flex-col gap-1 w-full sm:w-auto">
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
                    {formatTime12(shift.start)} - {formatTime12(shift.end)} ·{" "}
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

// ─── Leave Item Component ─────────────────────────────────────────────────────

function LeaveItem({
  leave,
  onDelete,
  isPast,
}: {
  leave: DoctorLeave;
  onDelete: (id: string) => void;
  isPast?: boolean;
}) {
  const startStr = formatDateReadable(leave.start_date);
  const endStr = formatDateReadable(leave.end_date);
  const isSingleDay = leave.start_date === leave.end_date;
  const dateLabel = isSingleDay ? startStr : `${startStr} - ${endStr}`;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
        isPast ? "border-border bg-muted/30 opacity-60" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isPast ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        }`}>
          <CalendarOff className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{dateLabel}</p>
          {leave.reason && (
            <p className="text-xs text-muted-foreground truncate">{leave.reason}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(leave.id)}
        className="h-8 w-8 shrink-0 flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        aria-label="Delete leave"
      >
        {isPast ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────────────────

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  // ─── General Settings Queries ───
  const { data: policies, isLoading: policiesLoading } = useGetBookingPoliciesQuery();
  const { data: leaves = [], isLoading: leavesLoading } = useGetLeavesQuery();
  const [updatePolicies] = useUpdateBookingPoliciesMutation();
  const [createLeave] = useCreateLeaveMutation();
  const [deleteLeave] = useDeleteLeaveMutation();

  // ─── Availability Queries ───
  const authUser = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const doctorId = authUser?.id ?? "";
  const { data: settings, isLoading: settingsLoading } = useGetAppointmentSettingsQuery(doctorId, { skip: !doctorId });
  const [updateSettings, { isLoading: isSavingAvailability }] = useUpdateAppointmentSettingsMutation();
  const { data: venues = [] } = useGetVenuesQuery();
  const [createVenue] = useCreateVenueMutation();
  const [updateVenue] = useUpdateVenueMutation();

  // ─── Templates Queries ───
  const { data: templates, isLoading: templatesLoading } = useListTemplatesQuery(doctorId);
  const [createTemplate] = useCreateTemplateMutation();
  const [updateTemplate, { isLoading: isSavingTemplates }] = useUpdateTemplateMutation();

  // ─── General Settings State ───
  const [local, setLocal] = useState<BookingPolicies>({
    booking_min_notice_hours: 2,
    booking_max_advance_days: 30,
    auto_confirm_bookings: true,
    cancellation_window_hours: 24,
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const hasLoadedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Leave Form State ───
  const [addingLeave, setAddingLeave] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  // ─── Availability State ───
  const [schedule, setSchedule] = useState<VenueSchedule[]>([]);
  const [slotDuration, setSlotDuration] = useState(15);
  const [maxPatients, setMaxPatients] = useState(10);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editVenueName, setEditVenueName] = useState("");
  const [menuOpenVenueId, setMenuOpenVenueId] = useState<string | null>(null);

  // ─── Templates State ───
  const [localTemplates, setLocalTemplates] = useState<Record<string, { subject: string; content: string; active: boolean }>>({});
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseCategory, setBrowseCategory] = useState<string | null>(null);

  // Reminder rows with an offset that doesn't match any current category (e.g. a
  // legacy 15-minute reminder) — kept visible so they can still be turned off
  // instead of silently continuing to fire with no way to manage them.
  const otherReminders = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => t.template_type === "reminder" && !KNOWN_REMINDER_OFFSETS.has(t.offset_minutes)
      ),
    [templates]
  );

  const handleToggleOtherReminder = async (id: string, checked: boolean) => {
    try {
      await updateTemplate({ id, data: { is_active: checked } }).unwrap();
    } catch {
      toast.error("Failed to update reminder");
    }
  };

  // ─── WhatsApp Configuration State ───
  const { data: whatsappConfig } = useGetWhatsAppConfigQuery();
  const [updateWhatsAppConfig, { isLoading: isSavingWhatsApp }] = useUpdateWhatsAppConfigMutation();
  const [whatsappLocal, setWhatsappLocal] = useState<WhatsAppConfig>({
    ultramsg_instance_id: '',
    ultramsg_token: '',
    whatsapp_number: '',
    whatsapp_enabled: false,
  });
  const [sendFromOwnNumber, setSendFromOwnNumber] = useState(false);

  // ─── Sync Policies from Server ───
  useEffect(() => {
    if (policies) {
      setLocal(policies);
      hasLoadedRef.current = true;
    }
  }, [policies]);

  // ─── Auto-save Policies on Change (debounced) ───
  const handleSavePolicies = async () => {
    setSaveStatus("saving");
    try {
      await updatePolicies(local).unwrap();
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  const handleSaveRef = useRef(handleSavePolicies);
  useEffect(() => { handleSaveRef.current = handleSavePolicies; });

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSaveRef.current(), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [local]);

  // ─── Leave Handlers ───
  const handleAddLeave = async () => {
    if (!leaveStart || !leaveEnd) return;
    try {
      await createLeave({
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason || undefined,
      }).unwrap();
      setAddingLeave(false);
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
    } catch {}
  };

  const handleDeleteLeave = async (id: string) => {
    try {
      await deleteLeave(id).unwrap();
    } catch {}
  };

  // ─── WhatsApp Configuration Handlers ───
  const whatsappLoadedRef = useRef(false);
  useEffect(() => {
    // Only hydrate from the server once - the 'Doctor' tag is shared with booking
    // policies/leaves, so unrelated saves elsewhere refetch this query and would
    // otherwise stomp on in-progress, unsaved edits here.
    if (whatsappConfig && !whatsappLoadedRef.current) {
      setWhatsappLocal(whatsappConfig);
      setSendFromOwnNumber(!!(whatsappConfig.ultramsg_instance_id || whatsappConfig.ultramsg_token));
      whatsappLoadedRef.current = true;
    }
  }, [whatsappConfig]);

  const handleWhatsAppConfigChange = (field: keyof WhatsAppConfig, value: string | boolean) => {
    setWhatsappLocal((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveWhatsAppConfig = async () => {
    try {
      await updateWhatsAppConfig({
        whatsapp_enabled: whatsappLocal.whatsapp_enabled,
        ultramsg_instance_id: sendFromOwnNumber ? (whatsappLocal.ultramsg_instance_id ?? '') : '',
        ultramsg_token: sendFromOwnNumber ? (whatsappLocal.ultramsg_token ?? '') : '',
        whatsapp_number: sendFromOwnNumber ? (whatsappLocal.whatsapp_number ?? '') : '',
      }).unwrap();
      toast.success("WhatsApp settings saved");
    } catch {
      toast.error("Failed to save WhatsApp settings");
    }
  };

  // ─── Sync Availability from Server ───
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

  // ─── Availability Helpers ───
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

  const handleSaveAvailability = async () => {
    if (!doctorId || hasErrors) return;
    const periods = schedule.flatMap((venue) => {
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
    } catch {}
  };

  // ─── Sync Templates from Server ───
  useEffect(() => {
    if (!templates) return;
    const map: Record<string, { subject: string; content: string; active: boolean }> = {};

    for (const cat of TEMPLATE_CATEGORIES) {
      const t = findTemplate(templates, cat.template_type, cat.offset_minutes ?? undefined);
      if (t) {
        map[cat.key] = { subject: t.subject ?? "", content: t.content, active: t.is_active };
      }
    }

    setLocalTemplates(map);
  }, [templates]);

  // ─── Template Handlers ───
  const handleToggleTemplate = (key: string, checked: boolean) => {
    setLocalTemplates((prev) => {
      const existing = prev[key] ?? { subject: "", content: "", active: true };
      return { ...prev, [key]: { ...existing, active: checked } };
    });
  };

  const handleTemplateContentChange = (key: string, field: "subject" | "content", value: string) => {
    setLocalTemplates((prev) => {
      const existing = prev[key] ?? { subject: "", content: "", active: true };
      return { ...prev, [key]: { ...existing, [field]: value } };
    });
  };

  const handleSaveTemplates = async () => {
    try {
      let savedCount = 0;
      let skippedEmpty = false;

      for (const cat of TEMPLATE_CATEGORIES) {
        const data = localTemplates[cat.key];
        if (!data) continue;

        const existing = findTemplate(templates, cat.template_type, cat.offset_minutes ?? undefined);

        if (existing) {
          await updateTemplate({
            id: existing.id,
            data: {
              content: data.content,
              subject: data.subject || undefined,
              is_active: data.active,
              template_type: cat.template_type,
              offset_minutes: cat.offset_minutes,
            },
          }).unwrap();
          savedCount++;
        } else if (data.content.trim()) {
          await createTemplate({
            doctor_id: doctorId,
            template_type: cat.template_type,
            subject: data.subject || undefined,
            content: data.content,
            offset_minutes: cat.offset_minutes ?? undefined,
          }).unwrap();
          savedCount++;
        } else {
          skippedEmpty = true;
        }
      }

      if (savedCount > 0) {
        toast.success("Templates saved");
      } else if (skippedEmpty) {
        toast.error("Add message content before saving a new template");
      }
    } catch {
      toast.error("Failed to save templates");
    }
  };

  // ─── Loading State ───
  if (policiesLoading || leavesLoading || settingsLoading || templatesLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const SaveIndicator = () => {
    if (saveStatus === "idle") return null;
    return (
      <div className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${
        saveStatus === "success" ? "text-green-600" : saveStatus === "error" ? "text-red-600" : "text-muted-foreground"
      }`}>
        {saveStatus === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
        {saveStatus === "success" && <CheckCircle2 className="h-3 w-3" />}
        {saveStatus === "error" && <AlertCircle className="h-3 w-3" />}
        {saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Saved" : "Save failed"}
      </div>
    );
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingLeaves = leaves.filter((l) => !isLeaveInPast(l.end_date));
  const pastLeaves = leaves.filter((l) => isLeaveInPast(l.end_date));
  const saveLabel = isSavingAvailability ? "Saving..." : savedAt ? "Saved" : "Save changes";

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <SettingsIcon className="h-4 w-4" /> },
    { id: "availability", label: "Availability", icon: <CalendarClock className="h-4 w-4" /> },
    { id: "templates", label: "Templates", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground">Manage your scheduling and booking preferences</p>
            </div>
          </div>
          <SaveIndicator />
        </div>

         {/* Tabs */}
         <div className="flex gap-1 mt-4 -mb-px overflow-x-auto pb-px scrollbar-hide">
           <div className="flex gap-1 whitespace-nowrap">
             {tabs.map((tab) => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                   activeTab === tab.id
                     ? "border-primary text-primary"
                     : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                 }`}
               >
                 {tab.icon}
                 {tab.label}
               </button>
             ))}
           </div>
         </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {activeTab === "general" && (
            <>
              {/* ────────────── BOOKING POLICIES ────────────── */}
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Booking Policies</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Control how and when patients can book with you.
                </p>

                <div className="space-y-6">
                  {/* Minimum notice */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Minimum notice before booking
                    </label>
                    <select
                      value={local.booking_min_notice_hours}
                      onChange={(e) => setLocal((p) => ({ ...p, booking_min_notice_hours: Number(e.target.value) }))}
                      className="h-10 w-full sm:w-64 px-3 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-ring"
                    >
                      {NOTICE_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Patients must book at least this long before the appointment time.
                    </p>
                  </div>

                  {/* Max advance */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      Maximum advance booking
                    </label>
                    <select
                      value={local.booking_max_advance_days}
                      onChange={(e) => setLocal((p) => ({ ...p, booking_max_advance_days: Number(e.target.value) }))}
                      className="h-10 w-full sm:w-64 px-3 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ADVANCE_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      How far in advance patients can book. Slots beyond this won't appear.
                    </p>
                  </div>

                  {/* Auto-confirm */}
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Auto-confirm bookings</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When on, new appointments are instantly confirmed. When off, they go into a pending queue for you or your staff to approve.
                      </p>
                    </div>
                    <Switch
                      checked={local.auto_confirm_bookings}
                      onCheckedChange={(c) => setLocal((p) => ({ ...p, auto_confirm_bookings: c }))}
                      aria-label="Auto-confirm bookings"
                    />
                  </div>

                  {/* Cancellation window */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Ban className="h-4 w-4 text-muted-foreground" />
                      Patient cancellation window
                    </label>
                    <select
                      value={local.cancellation_window_hours}
                      onChange={(e) => setLocal((p) => ({ ...p, cancellation_window_hours: Number(e.target.value) }))}
                      className="h-10 w-full sm:w-64 px-3 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CANCELLATION_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Patients can only cancel up to this time before the appointment. After this cutoff, they cannot self-cancel.
                    </p>
                  </div>
                </div>
              </section>

              {/* ────────────── WHATSAPP CONFIGURATION ────────────── */}
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">WhatsApp Configuration</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Configure WhatsApp messaging for your clinic. This allows you to send appointment reminders, OTP verification, and other notifications via WhatsApp.
                </p>

                <div className="space-y-4">
                  {/* Enable/Disable WhatsApp */}
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Enable WhatsApp Messaging</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, your clinic can send messages via WhatsApp using UltraMsg API.
                      </p>
                    </div>
                    <Switch
                      checked={whatsappLocal.whatsapp_enabled}
                      onCheckedChange={(c) => handleWhatsAppConfigChange('whatsapp_enabled', c)}
                      aria-label="Enable WhatsApp messaging"
                    />
                  </div>

                  {/* Send from own number toggle */}
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Send messages from your own number</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        By default, messages are sent from our shared WhatsApp number. Turn this on to use your own
                        UltraMsg account and number instead.
                      </p>
                    </div>
                    <Switch
                      checked={sendFromOwnNumber}
                      onCheckedChange={(c) => {
                        setSendFromOwnNumber(c);
                        if (!c) {
                          setWhatsappLocal((prev) => ({
                            ...prev,
                            ultramsg_instance_id: '',
                            ultramsg_token: '',
                            whatsapp_number: '',
                          }));
                        }
                      }}
                      aria-label="Send WhatsApp messages from your own number"
                    />
                  </div>

                  {sendFromOwnNumber && (
                    <>
                      {/* UltraMsg Instance ID */}
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          UltraMsg Instance ID
                        </label>
                        <Input
                          value={whatsappLocal.ultramsg_instance_id ?? ''}
                          onChange={(e) => handleWhatsAppConfigChange('ultramsg_instance_id', e.target.value)}
                          placeholder="e.g., instance123456"
                          className="h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your UltraMsg instance ID from <a href="https://ultramsg.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ultramsg.com</a>
                        </p>
                      </div>

                      {/* UltraMsg Token */}
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          UltraMsg Token
                        </label>
                        <Input
                          type="password"
                          value={whatsappLocal.ultramsg_token ?? ''}
                          onChange={(e) => handleWhatsAppConfigChange('ultramsg_token', e.target.value)}
                          placeholder="Your UltraMsg API token"
                          className="h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your UltraMsg API token for authentication
                        </p>
                      </div>

                      {/* WhatsApp Number */}
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          Clinic WhatsApp Number
                        </label>
                        <Input
                          value={whatsappLocal.whatsapp_number ?? ''}
                          onChange={(e) => handleWhatsAppConfigChange('whatsapp_number', e.target.value)}
                          placeholder="e.g., +1234567890"
                          className="h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          The WhatsApp number associated with your clinic (with country code)
                        </p>
                      </div>
                    </>
                  )}

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={handleSaveWhatsAppConfig} 
                      disabled={isSavingWhatsApp} 
                      className="gap-2"
                    >
                      {isSavingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isSavingWhatsApp ? "Saving..." : "Save WhatsApp Config"}
                    </Button>
                  </div>
                </div>
              </section>

              {/* ────────────── TIME OFF / VACATION ────────────── */}
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Time Off</h3>
                  </div>
                  {!addingLeave && (
                    <Button variant="outline" size="sm" onClick={() => setAddingLeave(true)} className="gap-1.5 h-8">
                      <Plus className="h-4 w-4" /> Add leave
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Block out dates when you're unavailable. Patients won't be able to book during these periods.
                </p>

                {/* Add leave form */}
                {addingLeave && (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Start date</span>
                        <input
                          type="date"
                          value={leaveStart}
                          min={todayStr}
                          onChange={(e) => {
                            setLeaveStart(e.target.value);
                            if (leaveEnd && e.target.value > leaveEnd) setLeaveEnd(e.target.value);
                          }}
                          className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">End date</span>
                        <input
                          type="date"
                          value={leaveEnd}
                          min={leaveStart || todayStr}
                          onChange={(e) => setLeaveEnd(e.target.value)}
                          className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Reason (optional)</span>
                      <input
                        type="text"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="e.g. Medical conference, Vacation"
                        className="h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={handleAddLeave} disabled={!leaveStart || !leaveEnd} className="gap-1.5">
                        <Save className="h-4 w-4" /> Save
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setAddingLeave(false);
                          setLeaveStart("");
                          setLeaveEnd("");
                          setLeaveReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Upcoming leaves */}
                {upcomingLeaves.length === 0 && pastLeaves.length === 0 && !addingLeave && (
                  <div className="flex gap-3 rounded-lg border border-dashed border-border p-4">
                    <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      No scheduled time off. Add leave dates to block your calendar.
                    </p>
                  </div>
                )}

                {upcomingLeaves.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upcoming</p>
                    {upcomingLeaves.map((leave) => (
                      <LeaveItem key={leave.id} leave={leave} onDelete={handleDeleteLeave} />
                    ))}
                  </div>
                )}

                {pastLeaves.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Past</p>
                    {pastLeaves.map((leave) => (
                      <LeaveItem key={leave.id} leave={leave} onDelete={handleDeleteLeave} isPast />
                    ))}
                  </div>
                )}
              </section>

              {/* ────────────── TAG MANAGEMENT ────────────── */}
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Tags</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Organize patients with tags and automation rules.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/doctor/tags')}
                    className="shrink-0"
                  >
                    Manage Tags
                  </Button>
                </div>
              </section>

              {/* ────────────── INFO CARD ────────────── */}
              <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-foreground font-medium">Coming soon</p>
                  <p>
                    <span className="font-medium text-foreground">Notification preferences</span> and{" "}
                    <span className="font-medium text-foreground">staff management</span> will be available here
                    in a future update. Stay tuned!
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === "availability" && (
            <>
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

              {/* Slot settings */}
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

              {/* Desktop save button */}
              <div className="hidden sm:block pt-2">
                <Button onClick={handleSaveAvailability} disabled={isSavingAvailability || hasErrors} className="gap-2">
                  {isSavingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saveLabel}
                </Button>
              </div>
            </>
          )}

          {activeTab === "templates" && (
            <>
              {/* Info hint */}
              <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-foreground font-medium">Message templates</p>
                  <p>
                    Configure automated notifications sent to your patients. Use{" "}
                    <span className="font-medium text-foreground">{"{{patient_name}}"}</span>,{" "}
                    <span className="font-medium text-foreground">{"{{slot_time}}"}</span>,{" "}
                    <span className="font-medium text-foreground">{"{{venue}}"}</span>, and{" "}
                    <span className="font-medium text-foreground">{"{{doctor_name}}"}</span> as dynamic placeholders.
                  </p>
                </div>
              </div>

              {/* Template cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <TemplateCard
                    key={cat.key}
                    category={cat}
                    subject={localTemplates[cat.key]?.subject ?? ""}
                    content={localTemplates[cat.key]?.content ?? ""}
                    active={localTemplates[cat.key]?.active ?? true}
                    onToggle={(c) => handleToggleTemplate(cat.key, c)}
                    onSubjectChange={(v) => handleTemplateContentChange(cat.key, "subject", v)}
                    onContentChange={(v) => handleTemplateContentChange(cat.key, "content", v)}
                    onBrowse={() => {
                      setBrowseCategory(cat.key);
                      setBrowseOpen(true);
                    }}
                  />
                ))}
              </div>

              {/* Other reminders (legacy offsets not covered by the categories above) */}
              {otherReminders.length > 0 && (
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Other reminders</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Reminders with a custom timing not shown above. You can only turn these on or off here.
                  </p>
                  <div className="space-y-2">
                    {otherReminders.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <span className="text-sm text-foreground">
                          Reminder ({formatOffsetMinutes(t.offset_minutes ?? 0)})
                        </span>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={(c) => handleToggleOtherReminder(t.id, c)}
                          />
                          <span className="text-xs font-medium text-muted-foreground">Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Placeholder tips */}
              <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-foreground font-medium">Available placeholders</p>
                  <p>
                    <span className="font-medium text-foreground">{"{{patient_name}}"}</span> - Patient's full name,{" "}
                    <span className="font-medium text-foreground">{"{{slot_time}}"}</span> - Appointment time (reflects the new time after a reschedule),{" "}
                    <span className="font-medium text-foreground">{"{{doctor_name}}"}</span> - Your name,{" "}
                    <span className="font-medium text-foreground">{"{{clinic_name}}"}</span> - Clinic name
                  </p>
                </div>
              </div>

              {/* Save button */}
              <div className="sm:block pt-2">
                <Button onClick={handleSaveTemplates} disabled={isSavingTemplates} className="gap-2">
                  {isSavingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSavingTemplates ? "Saving..." : "Save templates"}
                </Button>
              </div>

              {/* Browse Templates Modal */}
              <BrowseTemplatesModal
                open={browseOpen}
                categoryKey={browseCategory}
                categories={TEMPLATE_CATEGORIES}
                onClose={() => setBrowseOpen(false)}
                onUse={(key, { subject, content }) => {
                  handleTemplateContentChange(key, "subject", subject);
                  handleTemplateContentChange(key, "content", content);
                  setBrowseOpen(false);
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile sticky save bar - only show on availability tab */}
      {activeTab === "availability" && (
        <div className="sm:hidden border-t border-border bg-card p-3">
          <Button onClick={handleSaveAvailability} disabled={isSavingAvailability || hasErrors} className="w-full h-11 gap-2">
            {isSavingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
