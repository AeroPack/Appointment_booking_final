import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Switch } from "@/core/components/ui/switch";
import { Card } from "@/core/components/ui/card";
import {
  useGetBookingPoliciesQuery,
  useUpdateBookingPoliciesMutation,
  useGetLeavesQuery,
  useCreateLeaveMutation,
  useDeleteLeaveMutation,
} from "@/features/doctors/doctorSettingsApi";
import type { BookingPolicies, DoctorLeave } from "@/features/doctors/doctorSettingsApi";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateForInput(iso: string): string {
  return iso.slice(0, 10);
}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Settings() {
  // ─ Queries
  const { data: policies, isLoading: policiesLoading } = useGetBookingPoliciesQuery();
  const { data: leaves = [], isLoading: leavesLoading } = useGetLeavesQuery();
  const [updatePolicies] = useUpdateBookingPoliciesMutation();
  const [createLeave] = useCreateLeaveMutation();
  const [deleteLeave] = useDeleteLeaveMutation();

  // ─ Local state for policies
  const [local, setLocal] = useState<BookingPolicies>({
    booking_min_notice_hours: 2,
    booking_max_advance_days: 30,
    auto_confirm_bookings: true,
    cancellation_window_hours: 24,
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const hasLoadedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─ Leave form state
  const [addingLeave, setAddingLeave] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  // ─ Sync from server
  useEffect(() => {
    if (policies) {
      setLocal(policies);
      hasLoadedRef.current = true;
    }
  }, [policies]);

  // ─ Auto-save policies on change (debounced)
  const handleSave = async () => {
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

  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; });

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSaveRef.current(), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [local]);

  // ─ Leave handlers
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

  // ─ Loading state
  if (policiesLoading || leavesLoading) {
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
        {saveStatus === "saving" ? "Saving…" : saveStatus === "success" ? "Saved" : "Save failed"}
      </div>
    );
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Split leaves into upcoming and past
  const upcomingLeaves = leaves.filter((l) => !isLeaveInPast(l.end_date));
  const pastLeaves = leaves.filter((l) => isLeaveInPast(l.end_date));

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
              <p className="text-sm text-muted-foreground">Booking policies, time off & preferences</p>
            </div>
          </div>
          <SaveIndicator />
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

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

        </div>
      </div>
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
  const dateLabel = isSingleDay ? startStr : `${startStr} – ${endStr}`;

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
