#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

APP_NAME="appointment-booking-app"
echo "🚀 Scaffolding $APP_NAME with updated frontend architecture..."

# Create base directory
mkdir -p $APP_NAME
cd $APP_NAME

# 1. Generate package.json
echo "📦 Generating package.json with Tailwind, shadcn dependencies, and RTK..."
cat > package.json << 'EOF'
{
  "name": "appointment-booking-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "test": "vitest",
    "prepare": "husky install"
  },
  "dependencies": {
    "@reduxjs/toolkit": "^2.2.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.350.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-hook-form": "^7.51.0",
    "react-redux": "^9.1.0",
    "react-router-dom": "^6.22.3",
    "tailwind-merge": "^2.2.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@typescript-eslint/eslint-plugin": "^7.1.0",
    "@typescript-eslint/parser": "^7.1.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.6",
    "husky": "^9.0.11",
    "lint-staged": "^15.2.2",
    "msw": "^2.2.3",
    "postcss": "^8.4.35",
    "prettier": "^3.2.5",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2",
    "vite": "^5.1.5",
    "vitest": "^1.3.1"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
EOF

# 2. Create Directory Structure
echo "📂 Creating directory structure..."

# Design and scratch directories
mkdir -p design/generated

# Base src directories
mkdir -p src/{app,config,lib,components/ui,components/common,hooks,routes/{patient,doctor,staff},types,styles}

# Feature directories
FEATURES=("auth" "users" "appointments" "doctors" "settings" "venues" "tags")
for FEATURE in "${FEATURES[@]}"; do
  mkdir -p "src/features/$FEATURE/components"
done

# 3. Touch Files (Scaffold files layout)

# App layer
touch src/app/{store.ts,hooks.ts,listenerMiddleware.ts,uiSlice.ts,providers.tsx,router.tsx}

# Config & Lib layer
touch src/config/env.ts
touch src/lib/{baseQuery.ts,baseApi.ts}

# Features layer
# Auth
touch src/features/auth/{authApi.ts,authSlice.ts,auth.selectors.ts,types.ts,index.ts}
touch src/features/auth/components/{LoginForm.tsx,OtpInput.tsx}

# Users
touch src/features/users/{usersApi.ts,usersSlice.ts,users.selectors.ts,types.ts,index.ts}
touch src/features/users/components/{AccountPicker.tsx,DependentForm.tsx,ProfileForm.tsx}

# Appointments
touch src/features/appointments/{appointmentsApi.ts,bookingDraftSlice.ts,appointments.selectors.ts,types.ts,index.ts}
touch src/features/appointments/components/{SlotGrid.tsx,AppointmentCard.tsx,BookingSheet.tsx}

# Doctors (No slice)
touch src/features/doctors/{doctorsApi.ts,types.ts,index.ts}

# Settings (No slice)
touch src/features/settings/{settingsApi.ts,types.ts,index.ts}

# Venues (No slice)
touch src/features/venues/{venuesApi.ts,types.ts,index.ts}

# Tags (No slice)
touch src/features/tags/{tagsApi.ts,types.ts,index.ts}

# Routes layer
touch src/routes/patient/{Home.tsx,FindSlots.tsx,Confirm.tsx,Success.tsx,MyAppointments.tsx,Family.tsx,Profile.tsx}
touch src/routes/doctor/{Dashboard.tsx,AppointmentDetail.tsx,Availability.tsx,Templates.tsx}
touch src/routes/staff/{Dashboard.tsx,BookOnBehalf.tsx,Venues.tsx,Patients.tsx,Tags.tsx}

# Types, styles & Environment variables
touch src/types/api.ts
touch src/styles/tailwind.css
touch .env .env.local .env.production .env.example

echo "✅ File and directory structure created successfully!"
echo "➡️  Next steps: Run 'npm install' and initialize Tailwind/shadcn components."