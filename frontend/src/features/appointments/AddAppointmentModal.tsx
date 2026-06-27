import { useState, useEffect } from "react";
import { Loader2, Users, X } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useCreatePatientMutation, useSearchPatientsQuery } from "@/features/users/usersApi";
import { useBookOnBehalfMutation, useFindSlotsQuery, useRescheduleAppointmentMutation } from "./appointmentsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppointmentType = "checkup" | "consultation" | "followup" | "urgent" | "procedure";

export interface EditAppointmentData {
  appointmentId: string;
  date: string;
  scheduledStart: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const APPT_CONFIG: Record<AppointmentType, {
  label: string;
  pill: string;
  bar: string;
  card: string;
  text: string;
  icon: React.ElementType;
}> = {
  checkup:      { label: "Checkup",      pill: "bg-teal-100 text-teal-700",    bar: "border-teal-500",    card: "bg-teal-50",    text: "text-teal-800",   icon: Users   },
  consultation: { label: "Consultation", pill: "bg-blue-100 text-blue-700",    bar: "border-blue-500",    card: "bg-blue-50",    text: "text-blue-800",   icon: Users         },
  followup:     { label: "Follow-up",    pill: "bg-amber-100 text-amber-700",  bar: "border-amber-500",   card: "bg-amber-50",   text: "text-amber-800",  icon: Users         },
  urgent:       { label: "Urgent",       pill: "bg-red-100 text-red-700",      bar: "border-red-500",     card: "bg-red-50",     text: "text-red-800",    icon: Users },
  procedure:    { label: "Procedure",    pill: "bg-purple-100 text-purple-700", bar: "border-purple-500", card: "bg-purple-50",  text: "text-purple-800", icon: Users   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime12(time: string) {
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatISOTime(isoStart: string): string {
  const d = new Date(isoStart);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return formatTime12(hhmm);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddAppointmentModal({
  onClose,
  defaultDate,
  doctorId,
  editData,
}: {
  onClose: () => void;
  defaultDate: Date;
  doctorId: string | undefined;
  editData?: EditAppointmentData;
}) {
  const [date, setDate] = useState(() =>
    editData?.date ?? toDateKey(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate())
  );
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(editData?.scheduledStart ?? null);
  const [patientQuery, setPatientQuery] = useState(editData?.patientName ?? "");
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(
    editData ? { id: editData.patientId, name: editData.patientName } : null
  );
  const [mobileNumber, setMobileNumber] = useState(editData?.patientPhone ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [type, setType] = useState<AppointmentType>("checkup");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(patientQuery), 300);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const { data: slotsData, isLoading: slotsLoading } = useFindSlotsQuery(
    { doctor_id: doctorId!, from: date, to: date },
    { skip: !doctorId || !date }
  );

  const { data: patientResults } = useSearchPatientsQuery(
    { q: debouncedQuery },
    { skip: debouncedQuery.length < 2 || !!selectedPatient }
  );

  const [bookOnBehalf] = useBookOnBehalfMutation();
  const [rescheduleAppointment] = useRescheduleAppointmentMutation();
  const [createPatient] = useCreatePatientMutation();

  const slots = slotsData?.days.find((d) => d.date === date)?.slots ?? [];

  const handlePatientSelect = (p: { id: string; name: string; mobile_number?: string | null }) => {
    setSelectedPatient(p);
    setPatientQuery(p.name);
    if (p.mobile_number) setMobileNumber(p.mobile_number);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId || !selectedSlotStart || !patientQuery.trim()) return;

    setIsBooking(true);
    setError(null);

    try {
      let patientId = selectedPatient?.id;

      if (!patientId) {
        if (patientResults && patientResults.length > 0) {
          patientId = patientResults[0]?.id;
        } else {
          const newPatient = await createPatient({
            name: patientQuery.trim(),
            mobile_number: mobileNumber.trim() || undefined,
          }).unwrap();
          patientId = newPatient.id;
        }
      }

      if (editData) {
        await rescheduleAppointment({
          appointment_id: editData.appointmentId,
          patient_id: patientId ?? "",
          scheduled_start: selectedSlotStart,
          idempotency_key: crypto.randomUUID(),
          appointment_type: type,
        }).unwrap();
      } else {
        await bookOnBehalf({
          doctor_id: doctorId,
          patient_id: patientId ?? "",
          scheduled_start: selectedSlotStart,
          idempotency_key: crypto.randomUUID(),
          appointment_type: type,
          notes: notes.trim() || undefined,
        }).unwrap();
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-2xl rounded-xl shadow-lg flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-xl font-semibold">{editData ? "Edit Booking" : "New Booking"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Date row */}
          <div className="px-6 pt-4 pb-3 border-b border-border shrink-0">
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedSlotStart(null);
              }}
            />
          </div>

          {/* Body: two columns */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Left: Slot list */}
            <div className="flex-1 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-border">
              <div className="px-4 pt-3 pb-2 shrink-0">
                <h3 className="text-sm font-semibold text-foreground">Available Slots</h3>
                <p className="text-xs text-muted-foreground">Select a time slot for this date</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 max-h-48 md:max-h-none">
                {slotsLoading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    No slots available for this date
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {slots.map((slot) => {
                      const isSelected = selectedSlotStart === slot.start;
                      const isFull = slot.is_full;
                      const fillRatio = slot.capacity > 0 ? slot.booked_count / slot.capacity : 0;

                      return (
                        <button
                          key={slot.start}
                          type="button"
                          disabled={isFull}
                          onClick={() => setSelectedSlotStart(slot.start)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left w-full ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : isFull
                              ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                              : "border-border hover:border-primary/50 hover:bg-accent/40 cursor-pointer"
                          }`}
                        >
                          <span
                            className={`font-medium ${
                              isSelected ? "text-primary" : isFull ? "text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {formatISOTime(slot.start)}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isFull ? "bg-red-400" : fillRatio >= 0.7 ? "bg-amber-400" : "bg-green-400"
                                }`}
                                style={{ width: `${Math.min(100, fillRatio * 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs flex items-center gap-1 font-medium ${
                                isSelected
                                  ? "text-primary"
                                  : isFull
                                  ? "text-red-500"
                                  : fillRatio >= 0.7
                                  ? "text-amber-600"
                                  : "text-green-600"
                              }`}
                            >
                              <Users className="h-3 w-3" />
                              {slot.booked_count}/{slot.capacity}
                              {isFull && <span className="ml-1">Full</span>}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Patient details */}
            <div className="flex-1 flex flex-col px-4 pt-4 pb-4 gap-4">
              {/* Patient search */}
              <div className="relative">
                <label className="block text-sm font-medium mb-1">Patient</label>
                <input
                  type="text"
                  placeholder="Search or enter patient name"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setSelectedPatient(null);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  required
                  autoComplete="off"
                />
                {showDropdown && patientResults && patientResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {patientResults.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/40 first:rounded-t-lg last:rounded-b-lg transition-colors"
                        onMouseDown={() => handlePatientSelect({ id: p.id, name: p.name, mobile_number: p.mobile_number })}
                      >
                        {p.name}
                        {p.mobile_number && (
                          <span className="text-muted-foreground ml-2">({p.mobile_number})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile number */}
              <div>
                <label className="block text-sm font-medium mb-1">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="Enter mobile number"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">Optional. Family members can share the same number.</p>
              </div>

              {/* Appointment type */}
              <div>
                <label className="block text-sm font-medium mb-1">Appointment Type</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as AppointmentType)}
                >
                  {Object.entries(APPT_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              {/* Reason for visit */}
              <div>
                <label className="block text-sm font-medium mb-1">Reason for Visit</label>
                <textarea
                  placeholder="e.g. General checkup, Follow-up consultation..."
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm resize-none"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Selected slot summary */}
              {selectedSlotStart ? (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-sm">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Selected slot</span>
                  <p className="font-semibold text-primary mt-0.5">{formatISOTime(selectedSlotStart)}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">← Select a time slot from the left</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-6 py-4 border-t border-border shrink-0">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isBooking}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isBooking || !selectedSlotStart || !patientQuery.trim()}
              >
                {isBooking ? (editData ? "Updating..." : "Booking...") : (editData ? "Update Appointment" : "Book Appointment")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
