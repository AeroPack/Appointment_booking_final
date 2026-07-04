import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  CheckCircle2,
  MapPin,
  Phone,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  Calendar,
  Plus,
  Pencil,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Avatar, AvatarFallback } from "@/core/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import { useGetDoctorPatientsQuery } from "@/features/doctors/doctorDashboardApi";
import { useGetMeQuery } from "@/features/users/usersApi";
import { AddAppointmentModal, APPT_CONFIG, type AppointmentType, type EditAppointmentData } from "@/features/appointments/AddAppointmentModal";
import { DayPicker } from "react-day-picker";
import { format, isToday } from "date-fns";
import "react-day-picker/style.css";

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = "booked" | "finished" | "no_show" | "cancelled";

interface PatientRow {
  id: string;
  patientId: string;
  token: number;
  name: string;
  phone: string;
  age: number;
  gender: string;
  reason: string;
  appointmentType: string;
  venue: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  scheduledStart: string; // ISO timestamp
  status: Status;
}

const STATUS_META: Record<Status, { label: string; pill: string }> = {
  booked:    { label: "Waiting",   pill: "bg-teal-100 text-teal-700"   },
  finished:  { label: "Finished",  pill: "bg-green-100 text-green-700" },
  no_show:   { label: "No-show",   pill: "bg-red-100 text-red-700"     },
  cancelled: { label: "Cancelled", pill: "bg-slate-100 text-slate-600" },
};

const STATUS_OPTIONS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "booked", label: "Waiting" },
  { value: "finished", label: "Finished" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

function formatTime12(time: string) {
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

// A booked appointment scheduled in the future can be rescheduled / edited.
function isEditable(p: PatientRow): boolean {
  return p.status === "booked" && new Date(p.scheduledStart).getTime() > Date.now();
}

// ─── Sort indicator ───────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  if (dir === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
  if (dir === "desc") return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
}

// ─── Native select wrapper ────────────────────────────────────────────────────

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  icon: Icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  icon?: React.ElementType;
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`h-9 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring pr-8 ${
          Icon ? "pl-8" : "pl-3"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90 pointer-events-none" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PatientQueue() {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: apiPatients, isLoading, isError } = useGetDoctorPatientsQuery({ from: dateStr, to: dateStr });

  const { data: me } = useGetMeQuery();
  const doctorId = me?.id;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editData, setEditData] = useState<EditAppointmentData | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "token", desc: false }]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  const hasActiveFilters =
    search !== "" || statusFilter !== "all" || venueFilter !== "all" || reasonFilter !== "all";

  const patients: PatientRow[] = useMemo(() => {
    if (!apiPatients) return [];
    return apiPatients.map((p) => {
      const dt = new Date(p.scheduled_start);
      const istDate = new Date(dt.getTime() + 5.5 * 60 * 60 * 1000);
      const yyyy = istDate.getUTCFullYear();
      const mm = String(istDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(istDate.getUTCDate()).padStart(2, "0");
      const hh = String(istDate.getUTCHours()).padStart(2, "0");
      const min = String(istDate.getUTCMinutes()).padStart(2, "0");
      return {
        id: p.id,
        patientId: p.patient_id,
        token: p.token_number,
        name: p.patient_name,
        phone: p.phone || "—",
        age: p.age ?? 0,
        gender: p.gender || "Other",
        reason: p.reason || "—",
        appointmentType: p.appointment_type || "",
        venue: p.venue_name || "—",
        date: `${yyyy}-${mm}-${dd}`,
        time: `${hh}:${min}`,
        scheduledStart: p.scheduled_start,
        status: p.appointment_status as Status,
      };
    });
  }, [apiPatients]);

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (venueFilter !== "all" && p.venue !== venueFilter) return false;
      if (reasonFilter !== "all" && p.reason !== reasonFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.phone.toLowerCase().includes(q) &&
          !p.reason.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [patients, search, statusFilter, venueFilter, reasonFilter]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setVenueFilter("all");
    setReasonFilter("all");
  };

  const openEdit = useCallback((p: PatientRow) => {
    setEditData({
      appointmentId: p.id,
      date: p.date,
      scheduledStart: p.scheduledStart,
      patientId: p.patientId,
      patientName: p.name,
      patientPhone: p.phone === "—" ? "" : p.phone,
    });
  }, []);

  const venueOptions = useMemo(() => {
    const unique = Array.from(new Set(patients.map((p) => p.venue).filter(Boolean)));
    return [{ value: "all", label: "All venues" }, ...unique.map((v) => ({ value: v, label: v }))];
  }, [patients]);

  const reasonOptions = useMemo(() => {
    const unique = Array.from(new Set(patients.map((p) => p.reason).filter((r) => r && r !== "--")));
    return [{ value: "all", label: "All reasons" }, ...unique.map((r) => ({ value: r, label: r }))];
  }, [patients]);

  const columns = useMemo<ColumnDef<PatientRow>[]>(
    () => [
      {
        accessorKey: "token",
        header: "Token",
        cell: ({ row }) => {
          const finished = row.original.status === "finished";
          return (
            <div
              className={`w-9 h-9 rounded-lg font-bold flex items-center justify-center text-sm shrink-0 ${
                finished ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
              }`}
            >
              {String(row.original.token).padStart(2, "0")}
            </div>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Patient",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                {getInitials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.original.age} yrs · {row.original.gender}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: "Contact",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {row.original.phone}
          </span>
        ),
      },
      {
        accessorKey: "appointmentType",
        header: "Appointment Type",
        cell: ({ row }) => {
          const cfg = APPT_CONFIG[row.original.appointmentType as AppointmentType];
          if (!cfg) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.pill}`}>
              {cfg.label}
            </span>
          );
        },
      },
      {
        accessorKey: "venue",
        header: "Venue",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {row.original.venue}
          </span>
        ),
      },
      {
        accessorKey: "time",
        header: "Date & Time",
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-medium text-foreground">{formatTime12(row.original.time)}</p>
            <p className="text-xs text-muted-foreground">{formatDate(row.original.date)}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const meta = STATUS_META[row.original.status];
          return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.pill}`}>
              {meta.label}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {isEditable(row.original) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(row.original);
                }}
                aria-label="Edit appointment"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/doctor/appointment/${row.original.id}`);
              }}
              aria-label="View details"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <FileText className="h-4 w-4" />
            </button>
            {row.original.status === "booked" && (
              <button
                onClick={(e) => e.stopPropagation()}
                aria-label="Mark finished"
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [navigate, openEdit]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-row items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              Patient Queue{!isToday(selectedDate) && ` — ${format(selectedDate, "dd MMM yyyy")}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {patients.length} patient{patients.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Booking</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </header>

      {/* Filter toolbar */}
      <div className="bg-muted/40 border-b border-border px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, or reason…"
              className="pl-9 h-9 bg-background"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Date picker - kept outside the scroll area so its popup is not clipped */}
            <div className="relative shrink-0" ref={calendarRef}>
              <button
                onClick={() => setCalendarOpen((o) => !o)}
                className="h-9 rounded-md border border-input bg-background text-sm text-foreground flex items-center gap-2 px-3 cursor-pointer hover:bg-accent transition-colors"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(selectedDate, "dd MMM yyyy")}</span>
              </button>
              {calendarOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-lg p-2">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(day) => {
                      if (day) {
                        setSelectedDate(day);
                        setCalendarOpen(false);
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            {/* Selects - single scrollable row on mobile to avoid multi-row wrap */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 min-w-0 [&::-webkit-scrollbar]:hidden">
              <span className="hidden lg:flex shrink-0 items-center gap-1 text-xs text-muted-foreground font-medium">
                <Filter className="h-3.5 w-3.5" /> Filter:
              </span>
              <div className="shrink-0">
                <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
              </div>
              <div className="shrink-0">
                <FilterSelect
                  value={venueFilter}
                  onChange={setVenueFilter}
                  options={venueOptions}
                  icon={MapPin}
                />
              </div>
              <div className="shrink-0">
                <FilterSelect
                  value={reasonFilter}
                  onChange={setReasonFilter}
                  options={reasonOptions}
                  icon={FileText}
                />
              </div>
              {hasActiveFilters && (
                <div className="shrink-0">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9 text-muted-foreground">
                    <X className="h-4 w-4" /> Clear
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Loading patients...</h3>
            <p className="text-sm text-muted-foreground">Fetching queue from the server.</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load patients</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Something went wrong while fetching the queue. Please try again.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No patients found</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              No patients match your current filters. Try adjusting or clearing them.
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block rounded-xl border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="bg-muted/50 hover:bg-muted/50">
                      {hg.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        return (
                          <TableHead key={header.id} className="text-xs font-semibold uppercase tracking-wide">
                            {header.isPlaceholder ? null : canSort ? (
                              <button
                                onClick={header.column.getToggleSortingHandler()}
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                <SortIcon dir={header.column.getIsSorted()} />
                              </button>
                            ) : (
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => navigate(`/doctor/appointment/${row.original.id}`)}
                      className="cursor-pointer"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile / tablet card list */}
            <div className="lg:hidden flex flex-col gap-2">
              {table.getRowModel().rows.map((row) => {
                const p = row.original;
                const meta = STATUS_META[p.status];
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/doctor/appointment/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/doctor/appointment/${p.id}`);
                      }
                    }}
                    className="text-left rounded-xl border border-border bg-card p-3 hover:bg-accent/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg font-bold flex items-center justify-center text-sm shrink-0 bg-primary/10 text-primary">
                        {String(p.token).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.pill}`}>
                              {meta.label}
                            </span>
                            {isEditable(p) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(p);
                                }}
                                aria-label="Edit appointment"
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          <span>{p.age} yrs · {p.gender}</span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" /> {p.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" /> {p.venue}
                          </span>
                          <span>{formatDate(p.date)} · {formatTime12(p.time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {(isAddModalOpen || editData) && doctorId && (
        <AddAppointmentModal
          onClose={() => {
            setIsAddModalOpen(false);
            setEditData(null);
          }}
          defaultDate={selectedDate}
          doctorId={doctorId}
          editData={editData ?? undefined}
        />
      )}
    </div>
  );
}
