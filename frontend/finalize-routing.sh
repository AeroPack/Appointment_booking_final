#!/usr/bin/env bash
# Finalize file-based routing:
#  1) Fill EMPTY route files with a named-export placeholder (relocates the inline <div>s).
#  2) Flip the two `export default` stubs to `export function`.
#  3) Create the three role Layouts (render <Outlet/>) if missing.
#  4) Create RoleGuard (reads auth.user.role) if missing.
# Non-empty files are left untouched. Run from the frontend project root (contains src/).

if [ ! -d "src" ]; then echo "ERROR: run from the frontend project root."; exit 1; fi

STUBBED=0; KEPT=0; CREATED=0

# --- 1) named-export placeholders for empty route files ---------------------
stub_route_if_empty() {
  local f="$1"; local name; name="$(basename "$f" .tsx)"
  if [ -s "$f" ]; then echo "  keep   $f"; KEPT=$((KEPT+1)); return; fi
  mkdir -p "$(dirname "$f")"
  cat > "$f" <<EOF
export function ${name}() {
  return <div className="p-4">${name}</div>
}
EOF
  echo "  stub   $f"; STUBBED=$((STUBBED+1))
}

ROUTES=(
  src/routes/patient/Home.tsx
  src/routes/patient/DoctorDetail.tsx
  src/routes/patient/FindSlots.tsx
  src/routes/patient/Confirm.tsx
  src/routes/patient/Success.tsx
  src/routes/patient/MyAppointments.tsx
  src/routes/patient/AppointmentDetail.tsx
  src/routes/patient/Family.tsx
  src/routes/patient/Profile.tsx
  src/routes/doctor/Dashboard.tsx
  src/routes/doctor/AppointmentDetail.tsx
  src/routes/doctor/Availability.tsx
  src/routes/doctor/Templates.tsx
  src/routes/staff/Dashboard.tsx
  src/routes/staff/BookOnBehalf.tsx
  src/routes/staff/Patients.tsx
  src/routes/staff/Tags.tsx
  src/routes/staff/Venues.tsx
)
echo "route files:"
for f in "${ROUTES[@]}"; do stub_route_if_empty "$f"; done

# --- 2) flip the two default-export stubs to named --------------------------
echo "flip default -> named:"
for f in src/routes/patient/AppointmentDetail.tsx src/routes/patient/DoctorDetail.tsx; do
  if [ -f "$f" ] && grep -q 'export default function' "$f"; then
    sed -i 's/export default function/export function/' "$f"
    echo "  flipped $f"
  fi
done

# --- 3 & 4) layouts + RoleGuard (create if missing) -------------------------
write_if_missing() {
  local f="$1"
  if [ -e "$f" ]; then echo "  skip   $f"; cat >/dev/null; return; fi
  mkdir -p "$(dirname "$f")"; cat > "$f"; echo "  create $f"; CREATED=$((CREATED+1))
}

echo "layouts + guard:"
write_if_missing src/routes/patient/PatientLayout.tsx <<'EOF'
import { Outlet } from 'react-router-dom'

export function PatientLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-2xl p-4"><Outlet /></main>
      {/* TODO: patient bottom nav (Home, Appointments, Family, Profile) */}
    </div>
  )
}
EOF

write_if_missing src/routes/doctor/DoctorLayout.tsx <<'EOF'
import { Outlet } from 'react-router-dom'

export function DoctorLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-5xl p-4"><Outlet /></main>
      {/* TODO: doctor nav (Today, Schedule, Settings, Profile) */}
    </div>
  )
}
EOF

write_if_missing src/routes/staff/StaffLayout.tsx <<'EOF'
import { Outlet } from 'react-router-dom'

export function StaffLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl p-4"><Outlet /></main>
      {/* TODO: staff nav (Today, Patients, Venues, More) */}
    </div>
  )
}
EOF

write_if_missing src/app/RoleGuard.tsx <<'EOF'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import type { Role } from '@/types/api'

interface RoleGuardProps {
  allow: Role[]
  children: ReactNode
}

// Require auth + an allowed role; otherwise redirect to login.
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const role = useAppSelector((s) => s.auth.user?.role ?? null)
  if (!role) return <Navigate to="/login" replace />
  if (!allow.includes(role)) return <Navigate to="/login" replace />
  return <>{children}</>
}
EOF

echo ""
echo "Done. stubbed: ${STUBBED}  kept: ${KEPT}  created: ${CREATED}"
echo "Next: replace src/app/router.tsx with the file-based + RoleGuard version."