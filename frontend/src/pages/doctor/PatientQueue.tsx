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
  Tag,
  AlertTriangle,
  Send,
  MessageSquare,
  Save,
  Trash2,
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
import { Dialog } from "@/core/components/ui/dialog";
import { useGetDoctorPatientsQuery } from "@/features/doctors/doctorDashboardApi";
import { useGetMeQuery } from "@/features/users/usersApi";
import { useUpdateAppointmentStatusMutation, useBulkSendMessageMutation } from "@/features/appointments/appointmentsApi";
import { useListTemplatesQuery } from "@/features/settings/settingsApi";
import { useGetTagsQuery, useCreateTagMutation, useUpdateTagMutation, useDeleteTagMutation, type Tag as TagType } from "@/features/tags/tagsApi";
import { useGetCustomStatusesQuery, useCreateCustomStatusMutation, useUpdateCustomStatusMutation, useDeleteCustomStatusMutation, type CustomStatus } from "@/features/statuses/customStatusesApi";
import { AddAppointmentModal, APPT_CONFIG, type AppointmentType, type EditAppointmentData } from "@/features/appointments/AddAppointmentModal";
import { DayPicker } from "react-day-picker";
import { format, isToday } from "date-fns";
import { toast } from "sonner";
import "react-day-picker/style.css";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatientRow {  
  id: string;
  patientId: string;
  token: number;
  name: string;
  phone: string;
  gender: string;
  reason: string;
  appointmentType: string;
  venue: string;
  date: string;
  time: string;
  scheduledStart: string;
  customStatusId: string;
  statusName: string;
  statusColor: string | null;
  isSystemStatus: boolean;
}

const TAG_COLORS = [
  '#00201d', '#005c55', '#7f4025', '#DC2626',
  '#F59E0B', '#16A34A', '#6e7977', '#006f64', '#4fdbc8'
];

const COLOR_CLASSES: Record<string, string> = {
  '#00201d': 'bg-[#00201d]',
  '#005c55': 'bg-[#005c55]',
  '#7f4025': 'bg-[#7f4025]',
  '#DC2626': 'bg-[#DC2626]',
  '#F59E0B': 'bg-[#F59E0B]',
  '#16A34A': 'bg-[#16A34A]',
  '#6e7977': 'bg-[#6e7977]',
  '#006f64': 'bg-[#006f64]',
  '#4fdbc8': 'bg-[#4fdbc8]',
};

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

// A booked appointment from yesterday onward can be rescheduled / edited.
function isEditable(p: PatientRow): boolean {
  if (p.statusName !== "Waiting") return false;
  const now = new Date();
  const appointmentDate = new Date(p.scheduledStart);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  return appointmentDate >= yesterdayStart;
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
  const { data: apiPatients, isLoading, isError } = useGetDoctorPatientsQuery(
    { from: dateStr, to: dateStr },
    { refetchOnMountOrArgChange: true, refetchOnFocus: true, pollingInterval: 10000 }
  );

  const { data: me } = useGetMeQuery();
  const doctorId = me?.id;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editData, setEditData] = useState<EditAppointmentData | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "token", desc: false }]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // ─── Status Modal State ───
  const [statusModal, setStatusModal] = useState<{ appointmentId: string; patientName: string; currentStatusName: string } | null>(null);
  const [statusNotes, setStatusNotes] = useState("");
  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateAppointmentStatusMutation();

  // ─── Cancel Template State ───
  const [cancelTemplateId, setCancelTemplateId] = useState<string>("");

  // ─── Bulk Selection State ───
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  // ─── Bulk Send Modal State ───
  const [bulkSendModal, setBulkSendModal] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>("");
  const [bulkSend, { isLoading: isBulkSending }] = useBulkSendMessageMutation();

  // ─── Tags Modal State ───
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const { data: tags } = useGetTagsQuery();
  const [createTag] = useCreateTagMutation();
  const [updateTag] = useUpdateTagMutation();
  const [deleteTag] = useDeleteTagMutation();
  const [tagSearch, setTagSearch] = useState("");
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#005c55");
  const [isSavingTag, setIsSavingTag] = useState(false);

  // ─── Statuses Modal State ───
  const [statusesModalOpen, setStatusesModalOpen] = useState(false);
  const { data: customStatuses } = useGetCustomStatusesQuery();
  const [createCustomStatus] = useCreateCustomStatusMutation();
  const [updateCustomStatus] = useUpdateCustomStatusMutation();
  const [deleteCustomStatus] = useDeleteCustomStatusMutation();
  const [statusSearch, setStatusSearch] = useState("");
  const [editingStatus, setEditingStatus] = useState<CustomStatus | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#005c55");
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // ─── Templates ───
  const { data: templates } = useListTemplatesQuery(doctorId);
  const cancelTemplates = useMemo(
    () => templates?.filter((t) => t.template_type === "appointment_cancelled" && t.is_active) ?? [],
    [templates]
  );
  const allTemplates = useMemo(
    () => templates?.filter((t) => t.is_active) ?? [],
    [templates]
  );

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
        gender: p.gender || "Other",
        reason: p.reason || "—",
        appointmentType: p.appointment_type || "",
        venue: p.venue_name || "—",
        date: `${yyyy}-${mm}-${dd}`,
        time: `${hh}:${min}`,
        scheduledStart: p.scheduled_start,
        customStatusId: p.custom_status_id,
        statusName: p.status_name,
        statusColor: p.status_color,
        isSystemStatus: false,
      };
    });
  }, [apiPatients]);

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (statusFilter !== "all" && p.statusName !== statusFilter) return false;
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

  // ─── Selection helpers ───
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  const toggleRow = useCallback((id: string) => {
    setSelectedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleAll = useCallback(() => {
    const allSelected = filtered.length > 0 && filtered.every((p) => selectedRows[p.id]);
    if (allSelected) {
      setSelectedRows({});
    } else {
      const next: Record<string, boolean> = {};
      for (const p of filtered) next[p.id] = true;
      setSelectedRows(next);
    }
  }, [filtered, selectedRows]);

  const clearSelection = useCallback(() => setSelectedRows({}), []);

  const handleBulkSend = useCallback(async () => {
    if (!bulkTemplateId) return;
    const ids = Object.entries(selectedRows)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) return;

    try {
      await bulkSend({ appointment_ids: ids, template_id: bulkTemplateId }).unwrap();
      setBulkSendModal(false);
      setBulkTemplateId("");
      setSelectedRows({});
    } catch {
      // Error handled by RTK Query
    }
  }, [bulkSend, bulkTemplateId, selectedRows]);

  // ─── Tag Handlers ───
  const filteredTags = useMemo(() => {
    if (!tags) return [];
    if (!tagSearch) return tags;
    return tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()));
  }, [tags, tagSearch]);

  const handleSaveTag = async () => {
    const name = editingTag ? editingTag.name : newTagName;
    if (!name.trim()) return;
    setIsSavingTag(true);
    try {
      if (editingTag) {
        await updateTag({ id: editingTag.id, name: editingTag.name, color: newTagColor }).unwrap();
        toast.success("Tag updated");
      } else {
        await createTag({ name: newTagName.trim(), color: newTagColor }).unwrap();
        toast.success("Tag created");
      }
      resetTagForm();
    } catch {
      toast.error("Failed to save tag");
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleDeleteTag = async (tag: TagType) => {
    if (!confirm(`Delete tag "${tag.name}"?`)) return;
    try {
      await deleteTag(tag.id).unwrap();
      toast.success("Tag deleted");
    } catch {
      toast.error("Failed to delete tag");
    }
  };

  const resetTagForm = () => {
    setEditingTag(null);
    setNewTagName("");
    setNewTagColor("#005c55");
  };

  // ─── Status Handlers ───
  const filteredStatuses = useMemo(() => {
    if (!customStatuses) return [];
    if (!statusSearch) return customStatuses;
    return customStatuses.filter((s) => s.name.toLowerCase().includes(statusSearch.toLowerCase()));
  }, [customStatuses, statusSearch]);

  const handleSaveStatus = async () => {
    const name = editingStatus ? editingStatus.name : newStatusName;
    if (!name.trim()) return;
    setIsSavingStatus(true);
    try {
      if (editingStatus) {
        await updateCustomStatus({ id: editingStatus.id, name: editingStatus.name, color: editingStatus.color ?? undefined }).unwrap();
      } else {
        await createCustomStatus({ name: name.trim(), color: newStatusColor }).unwrap();
      }
      resetStatusForm();
    } catch {
      // Error handled by RTK Query
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleDeleteStatus = async (status: CustomStatus) => {
    if (status.is_system) return;
    try {
      await deleteCustomStatus(status.id).unwrap();
    } catch {
      // Error handled by RTK Query
    }
  };

  const resetStatusForm = () => {
    setEditingStatus(null);
    setNewStatusName("");
    setNewStatusColor("#005c55");
  };

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: string, templateId?: string) => {
    try {
      await updateStatus({
        id: appointmentId,
        status: newStatus,
        notes: statusNotes || undefined,
        template_id: templateId || undefined,
      }).unwrap();
      setStatusModal(null);
      setStatusNotes("");
      setCancelTemplateId("");
    } catch {
      // Error handled by RTK Query
    }
  }, [updateStatus, statusNotes]);

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
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={filtered.length > 0 && filtered.every((p) => selectedRows[p.id])}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={!!selectedRows[row.original.id]}
            onChange={() => toggleRow(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "token",
        header: "Token",
        cell: ({ row }) => {
          const finished = row.original.statusName !== "Waiting";
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
                {row.original.gender}
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
        accessorKey: "statusName",
        header: "Status",
        cell: ({ row }) => {
          const statusName = row.original.statusName;
          const statusColor = row.original.statusColor;
          const customStatusId = row.original.customStatusId;
          return (
            <select
              value={customStatusId}
              onChange={(e) => {
                e.stopPropagation();
                const selectedId = e.target.value;
                const selectedStatus = customStatuses?.find((s) => s.id === selectedId);
                if (!selectedStatus) return;
                if (selectedStatus.name === "Cancelled") {
                  setStatusModal({
                    appointmentId: row.original.id,
                    patientName: row.original.name,
                    currentStatusName: statusName,
                  });
                  setStatusNotes("");
                  setCancelTemplateId("");
                } else {
                  handleStatusChange(row.original.id, selectedStatus.name);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ backgroundColor: (statusColor || '#888') + '20', color: statusColor || '#888' }}
            >
              {customStatuses?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
          </div>
        ),
      },
    ],
    [navigate, openEdit, selectedRows, filtered, toggleAll, toggleRow]
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusesModalOpen(true)}
            className="gap-1.5"
          >
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Manage Status</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setTagsModalOpen(true)}
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Manage Tags</span>
          </Button>
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
                <FilterSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All statuses" },
                    ...(customStatuses?.map((s) => ({ value: s.name, label: s.name })) ?? []),
                  ]}
                />
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

      {/* Bulk Action Toolbar */}
      {selectedCount > 0 && (
        <div className="bg-primary/5 border-b border-primary/20 px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">
              {selectedCount} patient{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-4 w-4" /> Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkSendModal(true)}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" /> Send Template
              </Button>
            </div>
          </div>
        </div>
      )}

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
                            <select
                              value={p.customStatusId}
                              onChange={(e) => {
                                e.stopPropagation();
                                const selectedId = e.target.value;
                                const selectedStatus = customStatuses?.find((s) => s.id === selectedId);
                                if (!selectedStatus) return;
                                if (selectedStatus.name === "Cancelled") {
                                  setStatusModal({
                                    appointmentId: p.id,
                                    patientName: p.name,
                                    currentStatusName: p.statusName,
                                  });
                                  setStatusNotes("");
                                  setCancelTemplateId("");
                                } else {
                                  handleStatusChange(p.id, selectedStatus.name);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                              style={{ backgroundColor: (p.statusColor || '#888') + '20', color: p.statusColor || '#888' }}
                            >
                              {customStatuses?.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
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
                          <span>{p.gender}</span>
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

      {/* ─── Status Change Modal (Cancel only) ─── */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Cancel Appointment</h3>
              <button
                onClick={() => { setStatusModal(null); setCancelTemplateId(""); }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Cancel appointment for <span className="font-medium text-foreground">{statusModal.patientName}</span>
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Send WhatsApp message (optional)
              </label>
              <select
                value={cancelTemplateId}
                onChange={(e) => setCancelTemplateId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring px-3"
              >
                <option value="">No message</option>
                {cancelTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.subject || t.content.slice(0, 50)}
                  </option>
                ))}
              </select>
              {cancelTemplateId && (
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm text-foreground">
                    {cancelTemplates.find((t) => t.id === cancelTemplateId)?.content ?? ""}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add a note about this cancellation..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  if (statusModal) {
                    handleStatusChange(statusModal.appointmentId, "Cancelled", cancelTemplateId || undefined);
                  }
                }}
                disabled={isUpdatingStatus}
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Confirm Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusModal(null); setCancelTemplateId(""); }}
                disabled={isUpdatingStatus}
              >
                Back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Send Modal ─── */}
      {bulkSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Send Template Message</h3>
              <button
                onClick={() => { setBulkSendModal(false); setBulkTemplateId(""); }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Send a message to <span className="font-medium text-foreground">{selectedCount} patient{selectedCount !== 1 ? "s" : ""}</span>
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Select Template</label>
              <select
                value={bulkTemplateId}
                onChange={(e) => setBulkTemplateId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring px-3"
              >
                <option value="">Choose a template...</option>
                {allTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.template_type}] {t.subject || t.content.slice(0, 50)}
                  </option>
                ))}
              </select>
              {bulkTemplateId && (
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <p className="text-sm text-foreground">
                    {allTemplates.find((t) => t.id === bulkTemplateId)?.content ?? ""}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setBulkSendModal(false); setBulkTemplateId(""); }}
                disabled={isBulkSending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkSend}
                disabled={!bulkTemplateId || isBulkSending}
                className="gap-1.5"
              >
                {isBulkSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isBulkSending ? "Sending..." : `Send to ${selectedCount} patient${selectedCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tags Management Modal ─── */}
      <Dialog
        open={tagsModalOpen}
        onOpenChange={(open) => { if (!open) { setTagsModalOpen(false); resetTagForm(); } }}
        title="Manage Tags"
      >
        <div className="space-y-4">
          {/* Search + New Tag */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags..."
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => { resetTagForm(); setEditingTag(null); }}
              className="gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>

          {/* Tag List */}
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {filteredTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tags found</p>
            ) : (
              filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_CLASSES[tag.color || '#6e7977'] || 'bg-[#6e7977]'}`} />
                    <span className="text-sm font-medium">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingTag(tag); setNewTagColor(tag.color || '#005c55'); }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Create / Edit Form */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {editingTag ? 'Edit Tag' : 'New Tag'}
            </p>
            <Input
              value={editingTag ? editingTag.name : newTagName}
              onChange={(e) => editingTag ? setEditingTag({ ...editingTag, name: e.target.value }) : setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="h-9 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => editingTag ? setEditingTag({ ...editingTag, color }) : setNewTagColor(color)}
                  className={`w-7 h-7 rounded-full transition-all ${COLOR_CLASSES[color]} ${
                    (editingTag ? editingTag.color : newTagColor) === color
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetTagForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTag}
                disabled={isSavingTag || !(editingTag ? editingTag.name : newTagName).trim()}
                className="gap-1"
              >
                {isSavingTag ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {editingTag ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* ─── Statuses Management Modal ─── */}
      <Dialog
        open={statusesModalOpen}
        onOpenChange={(open) => { if (!open) { setStatusesModalOpen(false); resetStatusForm(); } }}
        title="Manage Statuses"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={statusSearch}
                onChange={(e) => setStatusSearch(e.target.value)}
                placeholder="Search statuses..."
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => { resetStatusForm(); setEditingStatus(null); }}
              className="gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>

          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {filteredStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No statuses found</p>
            ) : (
              filteredStatuses.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: status.color || '#6e7977' }}
                    />
                    <span className="text-sm font-medium">{status.name}</span>
                    {status.is_system && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">System</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingStatus(status); setNewStatusColor(status.color || '#005c55'); }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!status.is_system && (
                      <button
                        onClick={() => handleDeleteStatus(status)}
                        className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {editingStatus ? 'Edit Status' : 'New Status'}
            </p>
            <Input
              value={editingStatus ? editingStatus.name : newStatusName}
              onChange={(e) => editingStatus ? setEditingStatus({ ...editingStatus, name: e.target.value }) : setNewStatusName(e.target.value)}
              placeholder="Status name"
              className="h-9 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => editingStatus ? setEditingStatus({ ...editingStatus, color }) : setNewStatusColor(color)}
                  className={`w-7 h-7 rounded-full transition-all ${COLOR_CLASSES[color]} ${
                    (editingStatus ? editingStatus.color : newStatusColor) === color
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetStatusForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveStatus}
                disabled={isSavingStatus || (!(editingStatus?.name || newStatusName).trim())}
                className="gap-1.5"
              >
                {isSavingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {editingStatus ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
