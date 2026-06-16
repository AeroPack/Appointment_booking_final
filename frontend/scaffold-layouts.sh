#!/usr/bin/env bash
# Create the genuinely-missing files: the three role Layouts (currently inline,
# temporary functions in router.tsx) + an optional RoleGuard. Idempotent: never
# overwrites an existing file. Run from the frontend project root (contains src/).

if [ ! -d "src" ]; then
  echo "ERROR: run from the frontend project root (where src/ lives)."; exit 1
fi

CREATED=0; SKIPPED=0
write_if_missing() {                 # usage: write_if_missing <path> <<'EOF' ... EOF
  local f="$1"
  if [ -e "$f" ]; then echo "  skip   $f"; SKIPPED=$((SKIPPED+1)); cat >/dev/null; return; fi
  mkdir -p "$(dirname "$f")"
  cat > "$f"
  echo "  create $f"; CREATED=$((CREATED+1))
}

# --- Patient layout (renders <Outlet/> so nested routes show) ----------------
write_if_missing src/routes/patient/PatientLayout.tsx <<'EOF'
import { Outlet } from 'react-router-dom'

export function PatientLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-2xl p-4">
        <Outlet />
      </main>
      {/* TODO: patient bottom nav (Home, Appointments, Family, Profile) */}
    </div>
  )
}
EOF

# --- Doctor layout -----------------------------------------------------------
write_if_missing src/routes/doctor/DoctorLayout.tsx <<'EOF'
import { Outlet } from 'react-router-dom'

export function DoctorLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-5xl p-4">
        <Outlet />
      </main>
      {/* TODO: doctor nav (Today, Schedule, Settings, Profile) */}
    </div>
  )
}
EOF

# --- Staff layout ------------------------------------------------------------
write_if_missing src/routes/staff/StaffLayout.tsx <<'EOF'
import { Outlet } from 'react-router-dom'

export function StaffLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl p-4">
        <Outlet />
      </main>
      {/* TODO: staff nav (Today, Patients, Venues, More) */}
    </div>
  )
}
EOF

# --- RoleGuard (optional; for role-gated routes) -----------------------------
write_if_missing src/app/RoleGuard.tsx <<'EOF'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import type { Role } from '@/types/api'

interface RoleGuardProps {
  allow: Role[]
  children: ReactNode
}

// Wrap a layout/route to require auth + an allowed role.
// TODO: confirm the selector path matches your authSlice shape.
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const role = useAppSelector((s) => s.auth?.role ?? null)
  if (!role) return <Navigate to="/login" replace />
  if (!allow.includes(role)) return <Navigate to="/login" replace />
  return <>{children}</>
}
EOF

echo ""
echo "Done. created: ${CREATED}   skipped (existed): ${SKIPPED}"
echo "Next: replace src/app/router.tsx with the rewired version (imports real files)."