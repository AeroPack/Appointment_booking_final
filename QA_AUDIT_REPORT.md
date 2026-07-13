# QA Audit Report - Appointment Booking

**Target:** `/home/dell/Documents/AppointMentBooking` (running via docker-compose)
**Environment:** Frontend `http://localhost:3001` (nginx -> Vite build), Backend `http://localhost:5000` (Express 5), PostgreSQL 16
**Method:** Full end-to-end testing of every backend endpoint (all 9 modules, all roles) plus browser-driven UI testing of every page/button/flow (patient, doctor, staff) using a real Chrome session.
**Stack:** Express + PostgreSQL + JWT/OTP auth, React + Redux Toolkit (RTK Query) + React Router + Vite + Tailwind.

> Login note for testers: the app sends OTPs over WhatsApp/email, but the backend also prints every OTP to stdout (`auth.service.ts:59`). During testing, OTPs were read from `docker logs appointment_booking_backend`. This is itself a security finding (see MED-6).

---

## 1. Executive summary

| Severity | Count | Headline |
|---|---|---|
| CRITICAL | 2 | Appointment booking + entire appointment lifecycle 500s; all bot/chatbot endpoints 500 |
| HIGH | 3 | WhatsApp OTP/notifications silently fail; clinical-notes autosave loses data; web login is password-only (OTP users locked out) |
| MEDIUM | 3 | Entire Staff module is non-functional mock; many dead/no-op buttons; `send-otp` has no working channel |
| LOW | 5 | Settings 404 without param, wrong 201/200 status, orphan/placeholder code, verbose/plaintext debug logging, leftover test scaffolding |

**Bottom line:** The core product function - booking and managing an appointment - is 100% broken in the current Docker deployment due to an unapplied database migration, and the entire chatbot/WhatsApp integration is dead because required environment variables are not passed to the backend container. Both are deployment/config defects, not application-logic defects: once fixed, the underlying features work (verified). Beyond those, the patient and doctor web apps are largely functional; the staff web module is a UI mock with no backend wiring.

---

## 2. CRITICAL findings

### CRIT-1 - Appointment booking and full lifecycle return HTTP 500 (`column a.clinical_notes does not exist`)
**Impact:** The primary purpose of the app is unusable. Every one of these returns `500 INTERNAL_ERROR`:
- `POST /api/patient/book-slot` (patient books)
- `POST /api/appointments/book` (doctor/staff book on behalf)
- `GET /api/patient/appointments/:id` (appointment detail page)
- `PATCH /api/patient/appointments/:id/cancel`
- `PATCH /api/appointments/:id/reschedule`
- `PATCH /api/appointments/:id/status` (mark finished / no-show)

**Root cause:** The running database has no `clinical_notes` column on `appointments`, but the code reads/writes it:
- `backend/src/modules/appointments/appointments.repository.ts:125` - `a.clinical_notes AS notes` (used by `findAppointmentById`, called after every booking/read/update)
- `backend/src/modules/appointments/appointments.repository.ts:217` - `UPDATE appointments SET clinical_notes = $1 ...`

Migrations `20260710000002_add_password_to_users` and `20260710000003_add_clinical_notes_to_appointments` were **never applied** - `schema_migrations` stops at entry #8. The `docker-compose.yml` seeds `backend/src/db/schema.sql` only on **first** volume initialization (`docker-entrypoint-initdb.d`) and **never runs `npm run migrate:up`**, so any schema change after the volume was first created never reaches the DB. The persisted `appointment_pg_data` volume was created from an older schema.

**Verification:** Applying `ALTER TABLE appointments ADD COLUMN clinical_notes TEXT;` on the local DB immediately restored the full lifecycle - book (201), detail (200), cancel (200), reschedule (200), mark finished/no-show (200), idempotency (no duplicate), past-slot validation (400). (This column was added to the local test DB during verification - see section 6.)

**Fix:** Run migrations against the deployed DB (`npm run migrate:up`) and add a migration step to the deploy/compose flow so the DB is not left at a stale schema. Do not rely on `schema.sql` init for an existing volume.

### CRIT-2 - Entire bot/chatbot integration returns 500 (`BOT_API_KEY is not set on the server`)
**Impact:** All public bot endpoints fail, so the embeddable patient chatbot widget (served at `/chatbot.js`) is completely non-functional. Affected (all `500`):
`GET /api/bot/slots`, `POST /api/bot/book`, `GET /api/bot/doctor/:id`, `GET /api/bot/faq`, `GET /api/bot/lookup`, `GET /api/bot/config`.

**Root cause:** `docker-compose.yml` backend `environment:` block passes only `PORT, NODE_ENV, DATABASE_URL, JWT_SECRET, EMAIL_*`. It does **not** pass `BOT_API_KEY`, `ULTRAMSG_*`, or `APP_WHATSAPP_*`, all of which exist in `backend/.env` / `.env.example`. Confirmed via `docker exec appointment_booking_backend env` - none of these are present in the container.

**Fix:** Add the missing variables to the compose backend `environment` (or `env_file: ./backend/.env`).

---

## 3. HIGH findings

### HIGH-3 - WhatsApp OTP and notifications silently fail (same missing env as CRIT-2)
Because `ULTRAMSG_*` / `APP_WHATSAPP_*` are not in the container, the `whatsapp` channel is unconfigured:
- Login OTP over WhatsApp throws, but `AuthService.sendOtp` swallows the error (`auth.service.ts:73`), so `request-otp` returns success while **no message is ever delivered**. Real users cannot log in; testing only worked via the plaintext OTP in server logs.
- `POST /api/send-otp` (staff) returns `400 CHANNEL_NOT_CONFIGURED`.
**Fix:** ship the WhatsApp/UltraMsg env to the container; consider surfacing (not swallowing) delivery failures.

### HIGH-4 - Clinical Notes autosave silently loses data (`400` on every save for active appointments)
On the doctor Appointment Detail page, the "Clinical Notes" textarea autosaves by calling `PATCH /api/appointments/:id/status` with `{ status: <current status>, notes }`. The status endpoint's validator only accepts `status ∈ {finished, no_show}` (`appointments.routes.ts`). For a `booked` appointment it sends `status:"booked"` -> `400 VALIDATION_ERROR`. The notes are never persisted and no error is shown to the doctor. Verified live: request body `{"status":"booked","notes":"..."}` -> 400. **Fix:** give clinical notes their own endpoint/field, or allow a notes-only update that does not require a terminal status.

### HIGH-5 - Web login is password-only; OTP-only accounts cannot sign in
The login screen (`features/auth/components/LoginForm.tsx`) only submits `login-password`. There is no "request OTP" path on `/login`. Nearly all seeded users (all patients, 5 of 7 doctors, the staff user) have **no password** (`password_hash IS NULL`), so they cannot access the web app at all, even though the backend fully supports OTP login. Patients created by staff/doctor (`POST /api/patients`) get no password and no way in. **Fix:** add OTP login to the web login screen (the backend endpoints already exist and pass testing).

---

## 4. MEDIUM findings

### MED-6 - Entire Staff web module is a non-functional mock
`/staff/dashboard`, `/staff/book-on-behalf`, `/staff/patients`, `/staff/tags`, `/staff/venues` render hardcoded `MOCK_*` data; buttons are dead, `console.log`-only, or local-state-only. Verified: the staff dashboard shows fabricated names (Arthur Wellington, Lucia Martinez, Samuel Thompson...) not present in the DB, and issues only a single `/api/users/me` call - no real data fetches or mutations. Only `/staff/profile` is wired to real APIs. Note the backend staff endpoints themselves (patients, tags, book-on-behalf, messages) **do** work when called directly; only the staff UI is unwired. **Fix:** wire the staff pages to the existing APIs, or hide the module until implemented.

### MED-7 - Dead / no-op / broken buttons in patient & doctor UI (verified)
| Location | Control | Behaviour |
|---|---|---|
| Patient - My Appointments | "Reschedule" | No `onClick`; verified does nothing |
| Patient - Success | "Add to calendar" | Verified no-op |
| Doctor - Dashboard | "Export" | Verified no-op |
| Patient - Home | "Reschedule" | Passes appointment id as `doctorId` to FindSlots (wrong param) |
| Doctor - Queue (row) | green "Mark finished" | No handler (the working one is inside the detail page) |
| Doctor - Appt Detail | "Add Template", "Print Prescription", "View Patient Records History", floating "+" | No handlers |
| All Profile pages | "Edit Profile Photo" | Disabled, "coming soon" |
| Shared | "Configure Security", "Get Directions", "Learn More", "Notifications" switch, Language/Help/Accessibility rows | No handlers / local-only |

### MED-8 - `POST /api/send-otp` has no working channel
`channel:"email"` -> `400 UNSUPPORTED_CHANNEL`; `channel:"whatsapp"` -> `400 CHANNEL_NOT_CONFIGURED` (see HIGH-3). So the staff-facing OTP send is unusable regardless of channel in this deployment. (Auth-flow OTP email via `sendOtpEmail` is a separate path.)

---

## 5. LOW findings

- **LOW-9** `GET /api/appointment-setting` returns `404 DOCTOR_NOT_FOUND` when called without `?doctor_id` because `settings.controller.ts:12` passes `req.query.doctor_id` with no fallback to the authenticated doctor's own id. (Frontend always passes it, so not user-visible today, but it is a fragile contract.)
- **LOW-10** `POST /api/doctor/faq` returns `200` on create; every other create endpoint returns `201`. Minor REST inconsistency.
- **LOW-11** Dead/placeholder code: `pages/doctor/Availability.tsx` and `pages/doctor/Templates.tsx` are not routed; many `features/*/components/*` files are empty "Paste the Gemini-converted JSX here" stubs.
- **LOW-12** Verbose/insecure logging with `NODE_ENV=production`: startup prints `!!! ROUTES LOADED !!!`, every request logs `[VALIDATE]/[SERVICE]/[CONTROLLER]`, and **every OTP is logged in plaintext** (`[OTP] OTP for ...`). Remove debug logging and never log OTPs.
- **LOW-13** Leftover test scaffolding in shipped code: `verify-otp` schema refine message is `"THIS IS A TEST MESSAGE"` and validation errors are tagged `"(MODIFIED)"` (e.g. `Validation failed (MODIFIED)`), suggesting a tampered/debug build reached this environment.

---

## 6. What was tested and PASSED

All of the following were exercised end-to-end and behaved correctly (appointment items after the CRIT-1 column was restored):

- **Auth:** request-otp, verify-otp, refresh, `/me`, logout, login-password (incl. wrong-password 401), invalid/missing-token 401, role guards returning 403.
- **Users/Profile:** `GET/PATCH /users/me`, dependents full CRUD, `GET /patients/search` + `POST /patients` with correct role restriction (patient -> 403).
- **Doctors:** list, `:id/profile`, own profile get/patch, venues create/list/update, booking policies get/patch, leaves create/list/delete, clinic WhatsApp config get/patch.
- **Dashboard:** stats, patients, venue-type-stats, plus date-format validation (bad date -> 400).
- **Appointments:** find-slots, book-slot, **idempotency key returns same appointment (no duplicate)**, past-slot -> 400, missing idempotency_key -> 400, book-on-behalf, reschedule, status finished/no_show, invalid status -> 400, cross-role 403, cancel, list, detail.
- **Messages:** `send-message` (staff, with a valid template) -> 200 "scheduled".
- **Settings:** appointment-setting get (with `doctor_id`), message-templates full CRUD.
- **Tags:** full CRUD + assign/unassign to user + list user tags.
- **Bot (doctor side):** chatbot-config get/put, FAQ create/list/update/delete. (Only the public `x-bot-key` endpoints fail - CRIT-2.)
- **UI flows (real browser):**
  - Patient: login -> home -> choose doctor -> find slots (capacity shown) -> confirm -> **success (booked token generated)** -> appointments list -> detail; dead buttons confirmed.
  - Doctor: dashboard (stats + range tabs) -> queue -> "New Booking" modal creates a new patient and books on behalf (verified row in DB) -> appointment detail -> **Mark Finished works** (status persisted); settings General/Availability/Templates tabs load and booking-policy changes persist ("Saved").
  - Role-based routing/guards: unauthenticated -> `/login`; wrong-role redirects to the role's dashboard; token refresh-on-401 implemented in `core/store/baseQuery.ts`.

---

## 7. Recommended fix priority

1. **CRIT-1** Run DB migrations in the deployed environment and add a migrate step to the deploy pipeline. (Unblocks the entire product.)
2. **CRIT-2 / HIGH-3** Pass `BOT_API_KEY`, `ULTRAMSG_*`, `APP_WHATSAPP_*` to the backend container (use `env_file`). (Unblocks chatbot + WhatsApp.)
3. **HIGH-4** Fix clinical-notes saving (dedicated endpoint / notes-only update).
4. **HIGH-5** Add OTP login to the web login screen.
5. **MED-6** Wire or hide the Staff module.
6. **MED-7 / LOW-12 / LOW-13** Remove dead buttons, plaintext OTP logging, and test scaffolding before production.

---

## 8. Environment change made during this audit
To confirm CRIT-1's root cause, one **additive, non-destructive** change was applied to the local test database:
`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_notes TEXT;`
This matches migration `20260710000003` exactly and leaves the local app in a working state. For a clean migration history, run `cd backend && npm run migrate:up` (which will also apply the pending `add_password_to_users` migration). No application source files were modified.
