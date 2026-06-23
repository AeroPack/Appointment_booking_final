import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  CalendarCheck,
  CheckCircle2,
  UserX,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  Stethoscope,
  Video,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";

// ─── Static Data (demo) ───────────────────────────────────────────────────────

type RangeKey = "today" | "week" | "month";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

interface Kpi {
  label: string;
  value: string;
  delta: number; // percentage change
  icon: React.ElementType;
  accent: string; // icon bg + text
}

const KPIS: Kpi[] = [
  { label: "Total Patients", value: "248", delta: 12.5, icon: Users,         accent: "bg-blue-100 text-blue-700"   },
  { label: "Appointments",   value: "186", delta: 8.2,  icon: CalendarCheck, accent: "bg-teal-100 text-teal-700"   },
  { label: "Completed",      value: "164", delta: 4.1,  icon: CheckCircle2,  accent: "bg-green-100 text-green-700" },
  { label: "No-shows",       value: "9",   delta: -2.3, icon: UserX,         accent: "bg-red-100 text-red-700"     },
];

// Weekly appointments — Mon..Sun
const WEEK_BARS = [
  { day: "Mon", booked: 22, finished: 18 },
  { day: "Tue", booked: 28, finished: 25 },
  { day: "Wed", booked: 19, finished: 17 },
  { day: "Thu", booked: 31, finished: 27 },
  { day: "Fri", booked: 26, finished: 24 },
  { day: "Sat", booked: 14, finished: 12 },
  { day: "Sun", booked: 6,  finished: 5  },
];

// Appointment type distribution (donut)
const TYPE_DIST = [
  { label: "Checkup",      value: 84, color: "#14b8a6", icon: Stethoscope   },
  { label: "Consultation", value: 56, color: "#3b82f6", icon: Video         },
  { label: "Follow-up",    value: 32, color: "#f59e0b", icon: Clock         },
  { label: "Urgent",       value: 14, color: "#ef4444", icon: AlertTriangle },
];

// Status breakdown (progress bars)
const STATUS_BREAKDOWN = [
  { label: "Completed", value: 164, total: 186, color: "bg-green-500" },
  { label: "Waiting",   value: 13,  total: 186, color: "bg-teal-500"  },
  { label: "Cancelled", value: 9,   total: 186, color: "bg-slate-400" },
  { label: "No-show",   value: 9,   total: 186, color: "bg-red-500"   },
];

// Recent appointments summary table
interface RecentRow {
  id: string;
  patient: string;
  type: string;
  time: string;
  status: "Completed" | "Waiting" | "No-show" | "Cancelled";
}

const RECENT: RecentRow[] = [
  { id: "a1", patient: "Michael Chen", type: "Consultation",   time: "09:00 AM", status: "Completed" },
  { id: "a2", patient: "Sarah Miller", type: "Annual Physical", time: "10:30 AM", status: "Completed" },
  { id: "a3", patient: "James Wilson", type: "Follow-up",       time: "01:00 PM", status: "Waiting"   },
  { id: "a4", patient: "Emily Davis",  type: "Urgent Care",     time: "01:30 PM", status: "Waiting"   },
  { id: "a5", patient: "Robert Lee",   type: "Checkup",         time: "02:30 PM", status: "No-show"   },
  { id: "a6", patient: "Anna Patel",   type: "Procedure",       time: "03:15 PM", status: "Cancelled" },
];

const STATUS_PILL: Record<RecentRow["status"], string> = {
  Completed: "bg-green-100 text-green-700",
  Waiting: "bg-teal-100 text-teal-700",
  "No-show": "bg-red-100 text-red-700",
  Cancelled: "bg-slate-100 text-slate-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Delta chip ───────────────────────────────────────────────────────────────

function DeltaChip({ delta }: { delta: number }) {
  const positive = delta >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        positive ? "text-green-600" : "text-red-600"
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}%
    </span>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyBarChart() {
  const max = Math.max(...WEEK_BARS.map((b) => b.booked));
  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Appointments This Week</h3>
            <p className="text-xs text-muted-foreground">Booked vs. completed per day</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary/30" /> Booked
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Completed
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 sm:gap-4 h-48 pt-4">
          {WEEK_BARS.map((b) => (
            <div key={b.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="relative w-full flex justify-center items-end gap-1 h-full">
                <div
                  className="w-1/2 max-w-[18px] rounded-t-md bg-primary/25 transition-all"
                  style={{ height: `${(b.booked / max) * 100}%` }}
                  title={`${b.booked} booked`}
                />
                <div
                  className="w-1/2 max-w-[18px] rounded-t-md bg-primary transition-all"
                  style={{ height: `${(b.finished / max) * 100}%` }}
                  title={`${b.finished} completed`}
                />
              </div>
              <span className="text-xs text-muted-foreground">{b.day}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Donut Chart (type distribution) ─────────────────────────────────────────

function TypeDonut() {
  const total = TYPE_DIST.reduce((s, t) => s + t.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Appointment Types</h3>
        <p className="text-xs text-muted-foreground mb-4">Distribution this month</p>

        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
              {TYPE_DIST.map((t) => {
                const fraction = t.value / total;
                const dash = fraction * circumference;
                const seg = (
                  <circle
                    key={t.label}
                    cx="75"
                    cy="75"
                    r={radius}
                    fill="none"
                    stroke={t.color}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return seg;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">total</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            {TYPE_DIST.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground flex-1 truncate">{t.label}</span>
                  <span className="font-semibold text-foreground">{t.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status Breakdown (progress bars) ────────────────────────────────────────

function StatusBreakdown() {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Status Breakdown</h3>
        <p className="text-xs text-muted-foreground mb-4">Of all appointments</p>

        <div className="flex flex-col gap-4">
          {STATUS_BREAKDOWN.map((s) => {
            const pct = Math.round((s.value / s.total) * 100);
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">
                    {s.value} <span className="text-xs">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent Appointments Table ───────────────────────────────────────────────

function RecentTable({ onView }: { onView: () => void }) {
  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent Appointments</h3>
            <p className="text-xs text-muted-foreground">Latest activity today</p>
          </div>
          <Button variant="outline" size="sm" onClick={onView} className="gap-1">
            View queue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Patient</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Type</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Time</th>
                <th className="text-left font-medium text-muted-foreground px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {RECENT.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{r.patient}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.time}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-border">
          {RECENT.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{r.patient}</p>
                <p className="text-xs text-muted-foreground">{r.type} · {r.time}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_PILL[r.status]}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("week");

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
            {/* Range switcher */}
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

            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* KPI cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {KPIS.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <DeltaChip delta={k.delta} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{k.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <WeeklyBarChart />
          <TypeDonut />
        </section>

        {/* Table + status row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <RecentTable onView={() => navigate("/doctor/queue")} />
          <StatusBreakdown />
        </section>
      </div>
    </div>
  );
}
