import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  CalendarCheck,
  CheckCircle2,
  UserX,
  ChevronRight,
  Download,
  Stethoscope,
  Video,
  Clock,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import {
  useGetDoctorStatsQuery,
  useGetDoctorPatientsQuery,
  useGetVenueTypeStatsQuery,
} from "@/features/doctors/doctorDashboardApi";

// ─── Types ──────────────────────────────────────────────────────────────────

type RangeKey = "today" | "week" | "month";

// ─── Date range helpers ──────────────────────────────────────────────────────

function getISTDate(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getSunday(dateStr: string): string {
  const monday = new Date(getMonday(dateStr));
  monday.setDate(monday.getDate() + 6);
  return monday.toISOString().slice(0, 10);
}

function getMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

function getMonthEnd(dateStr: string): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function getDateRange(range: RangeKey): { from: string; to: string } {
  const today = getISTDate();
  switch (range) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: getMonday(today), to: getSunday(today) };
    case "month":
      return { from: getMonthStart(today), to: getMonthEnd(today) };
  }
}

function getRangeLabel(range: RangeKey): string {
  switch (range) {
    case "today":
      return "Today";
    case "week":
      return "This Week";
    case "month":
      return "This Month";
  }
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRangeDateLabel(range: RangeKey): string {
  const { from, to } = getDateRange(range);
  const fromLabel = formatDateLabel(from);
  const toLabel = formatDateLabel(to);
  if (from === to) return fromLabel;
  return `${fromLabel} - ${toLabel}`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

const TYPE_COLORS: Record<string, string> = {
  checkup: "#14b8a6",
  consultation: "#3b82f6",
  followup: "#f59e0b",
  urgent: "#ef4444",
  procedure: "#8b5cf6",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  checkup: Stethoscope,
  consultation: Video,
  followup: Clock,
  urgent: AlertTriangle,
  procedure: Wrench,
};

const TYPE_LABELS: Record<string, string> = {
  checkup: "Checkup",
  consultation: "Consultation",
  followup: "Follow-up",
  urgent: "Urgent",
  procedure: "Procedure",
};

const STATUS_PILL: Record<string, string> = {
  finished: "bg-green-100 text-green-700",
  booked: "bg-blue-100 text-blue-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
};

// ─── Venue Pie Chart Card ────────────────────────────────────────────────────

function VenuePieChart({
  venue,
}: {
  venue: {
    venue_id: string;
    venue_name: string;
    types: Array<{ type: string; count: number }>;
    total: number;
  };
}) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = venue.types.map((t) => {
    const fraction = t.count / venue.total;
    const dash = fraction * circumference;
    const seg = {
      type: t.type,
      color: TYPE_COLORS[t.type] || "#94a3b8",
      dash,
      offset,
      count: t.count,
    };
    offset += dash;
    return seg;
  });

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3 truncate">
          {venue.venue_name}
        </h4>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
              {segments.map((seg) => (
                <circle
                  key={seg.type}
                  cx="55"
                  cy="55"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="14"
                  strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                  strokeDashoffset={-seg.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-foreground">{venue.total}</span>
              <span className="text-[10px] text-muted-foreground">total</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            {venue.types.map((t) => {
              const Icon = TYPE_ICONS[t.type] || Stethoscope;
              return (
                <div key={t.type} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[t.type] || "#94a3b8" }}
                  />
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-foreground flex-1 truncate">
                    {TYPE_LABELS[t.type] || t.type}
                  </span>
                  <span className="font-semibold text-foreground">{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent Appointments Table ───────────────────────────────────────────────

function RecentTable({
  patients,
  isLoading,
  onView,
}: {
  patients?: Array<{
    id: string;
    patient_name: string;
    appointment_type: string;
    scheduled_start: string;
    appointment_status: string;
  }>;
  isLoading: boolean;
  onView: () => void;
}) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const formatStatus = (status: string) => {
    const map: Record<string, string> = {
      finished: "Completed",
      booked: "Booked",
      no_show: "No-show",
      cancelled: "Cancelled",
    };
    return map[status] || status;
  };

  return (
    <Card className="h-full">
      <CardContent className="p-0 h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Recent Appointments
            </h3>
            <p className="text-xs text-muted-foreground">Latest activity</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="gap-1"
          >
            View queue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-4 bg-muted rounded w-20" />
                </div>
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : !patients?.length ? (
          <div className="p-5 text-center text-muted-foreground text-sm flex-1 flex items-center justify-center">
            No appointments found for this period
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left font-medium text-muted-foreground px-5 py-2.5">
                      Patient
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-2.5">
                      Type
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-2.5">
                      Time
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-2.5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {p.patient_name}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground capitalize">
                        {TYPE_LABELS[p.appointment_type] || p.appointment_type}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatTime(p.scheduled_start)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_PILL[p.appointment_status] || ""
                          }`}
                        >
                          {formatStatus(p.appointment_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="sm:hidden divide-y divide-border flex-1">
              {patients.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {p.patient_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[p.appointment_type] || p.appointment_type} ·{" "}
                      {formatTime(p.scheduled_start)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      STATUS_PILL[p.appointment_status] || ""
                    }`}
                  >
                    {formatStatus(p.appointment_status)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("today");

  const dateRange = useMemo(() => getDateRange(range), [range]);

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useGetDoctorStatsQuery(dateRange);

  const {
    data: patients,
    isLoading: patientsLoading,
    error: patientsError,
  } = useGetDoctorPatientsQuery(dateRange);

  const {
    data: venueStats,
    isLoading: venueLoading,
    error: venueError,
  } = useGetVenueTypeStatsQuery(dateRange);

  const kpis = [
    {
      label: "Total Patients",
      value: stats?.total_patients ?? 0,
      icon: Users,
      accent: "bg-blue-100 text-blue-700",
    },
    {
      label: "Appointments",
      value: stats?.booked ?? 0,
      icon: CalendarCheck,
      accent: "bg-teal-100 text-teal-700",
    },
    {
      label: "Completed",
      value: stats?.finished ?? 0,
      icon: CheckCircle2,
      accent: "bg-green-100 text-green-700",
    },
    {
      label: "No-shows",
      value: stats?.no_show ?? 0,
      icon: UserX,
      accent: "bg-red-100 text-red-700",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
            <p className="text-sm text-muted-foreground">{todayLabel()}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-muted rounded-lg p-0.5 shrink-0">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    range === r.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Error */}
        {(statsError || patientsError || venueError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            Failed to load dashboard data. Please try again.
          </div>
        )}

        {/* KPI cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">
                      {statsLoading ? (
                        <span className="inline-block h-7 w-12 bg-muted animate-pulse rounded" />
                      ) : (
                        k.value
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {k.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Range label */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {getRangeLabel(range)} Overview
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getRangeDateLabel(range)}
          </p>
        </div>

        {/* Table + venue pie charts */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="lg:col-span-2">
            <RecentTable
              patients={patients}
              isLoading={patientsLoading}
              onView={() => navigate("/doctor/queue")}
            />
          </div>

          <div className="flex flex-col gap-3">
            {venueLoading ? (
              [1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="flex gap-4">
                        <div className="w-[110px] h-[110px] bg-muted rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-muted rounded w-24" />
                          <div className="h-3 bg-muted rounded w-20" />
                          <div className="h-3 bg-muted rounded w-28" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : venueStats && venueStats.length > 0 ? (
              venueStats.map((v) => (
                <VenuePieChart key={v.venue_id} venue={v} />
              ))
            ) : (
              <Card>
                <CardContent className="p-5 flex flex-col items-center justify-center text-center min-h-[180px]">
                  <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No appointments found for this period
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MapPin({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
