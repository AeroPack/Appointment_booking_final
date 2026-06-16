#!/usr/bin/env bash
# Scaffold missing destination files for the Stitch -> Gemini conversion (batches 1-3).
# Idempotent: creates a file ONLY if it doesn't already exist. Never overwrites your work.
# Run from the frontend project root (the folder that contains src/).

if [ ! -d "src" ]; then
  echo "ERROR: run this from the frontend project root (where src/ lives)."
  exit 1
fi

CREATED=0
SKIPPED=0

# --- helpers ----------------------------------------------------------------
stub_component() {            # presentational component: typed props, renders nothing yet
  local f="$1"
  if [ -e "$f" ]; then echo "  skip  $f"; SKIPPED=$((SKIPPED+1)); return; fi
  mkdir -p "$(dirname "$f")"
  local name; name="$(basename "$f" .tsx)"
  cat > "$f" <<EOF
// ${name} — presentational component. Paste the Gemini-converted JSX here.
// Rules: data via typed props ONLY. No fetch / RTK Query / Redux / routing / effects.

export interface ${name}Props {
  // TODO: define props (derive from src/types/generated or the feature's types.ts)
}

export function ${name}({}: ${name}Props) {
  return null;
}
EOF
  echo "  create ${f}"; CREATED=$((CREATED+1))
}

stub_route() {                # route/page: container that wires RTK Query hooks
  local f="$1"
  if [ -e "$f" ]; then echo "  skip  $f"; SKIPPED=$((SKIPPED+1)); return; fi
  mkdir -p "$(dirname "$f")"
  local name; name="$(basename "$f" .tsx)"
  cat > "$f" <<EOF
// ${name} route/page — composes feature component(s) and wires RTK Query hooks.
// Fetch data here; pass results down as props to the presentational component(s).

export default function ${name}() {
  return null;
}
EOF
  echo "  create ${f}"; CREATED=$((CREATED+1))
}

# --- folders that should exist ----------------------------------------------
mkdir -p design/generated scripts \
         src/components/common \
         src/features/doctors/components

# --- shared (components/common) ---------------------------------------------
echo "common:"
stub_component src/components/common/StatusPill.tsx     # appointment status badge
stub_component src/components/common/EmptyState.tsx     # reusable empty/no-data view
stub_component src/components/common/Logo.tsx           # from serene_health_logo

# --- auth (LoginForm / OtpForm already exist) -------------------------------

# --- users (account_picker, family_members, profile_settings) ---------------
echo "users:"
stub_component src/features/users/components/FamilyMembers.tsx   # dependents list

# --- appointments (choose_a_time, confirm, success, my_appts, detail, dash) -
echo "appointments:"
stub_component src/features/appointments/components/DateSelector.tsx        # choose_a_time
stub_component src/features/appointments/components/BookingSuccess.tsx      # booking_success
stub_component src/features/appointments/components/AppointmentList.tsx     # my_appointments
stub_component src/features/appointments/components/AppointmentDetail.tsx   # appointment_detail
stub_component src/features/appointments/components/NextAppointmentCard.tsx # patient_dashboard

# --- doctors (doctor_details) -----------------------------------------------
echo "doctors:"
stub_component src/features/doctors/components/DoctorDetail.tsx
stub_component src/features/doctors/components/DoctorCard.tsx

# --- routes that don't exist yet --------------------------------------------
echo "routes:"
stub_route src/routes/patient/DoctorDetail.tsx       # wraps doctors/DoctorDetail
stub_route src/routes/patient/AppointmentDetail.tsx  # patient view (cancel-only)

# --- summary ----------------------------------------------------------------
echo ""
echo "Done. created: ${CREATED}   skipped (already existed): ${SKIPPED}"
echo ""
echo "Manual cleanup (NOT done by this script, to avoid deleting your work):"
echo "  1) git mv src/rename-desktop-assets.sh src/reorganize-stitch.sh scripts/"
echo "  2) rm -r src/features/stitch_markdown_design_system   # duplicate of docs/DESIGN.md"
echo "  3) After converting their screens, delete src/features/dashboard and"
echo "     src/features/profile — they are not features (output goes to appointments/"
echo "     users + routes). Their stitch screens convert into existing component files."