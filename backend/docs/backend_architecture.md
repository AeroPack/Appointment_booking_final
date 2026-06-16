# Appointment Booking — Backend Implementation Roadmap

A phased plan to build every API endpoint, with test cases per endpoint. Built around
the existing module layout (`controller` / `service` / `repository` / `routes` /
`middleware` / `types` per feature) and the finalized `schema.sql`.

---

## 0. Conventions (decide once, apply everywhere)

**Response envelope** — every response, success or error:
```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "SLOT_FULL", "message": "...", "details": [] } }
```

**HTTP status usage**
| Code | When |
|------|------|
| 200 | OK (GET, successful update) |
| 201 | Resource created (booking, dependent) |
| 400 | Validation failed (bad body/query) |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but not allowed (wrong role, cross-tenant, not your dependent) |
| 404 | Resource not found *within your clinic* |
| 409 | Conflict (slot full for patient path, duplicate booking, idempotency replay mismatch) |
| 429 | Rate limited (OTP) |
| 500 | Unexpected |

**Auth** — Bearer JWT access token (short-lived) + rotating refresh token.
JWT payload carries `user_id`, `clinic_id`, `role`. **Every repository query is scoped
by `clinic_id` from the token — never from the request body.**

**Roles** — `doctor`, `staff`, `patient`. RBAC enforced in middleware.

**Validation** — schema-validate every input (recommend `zod`) at the controller edge;
services assume validated input.

**Suggested stack for tests** — Jest + Supertest, a dedicated test database, each test
wrapped in a transaction that rolls back (or truncate-between-tests) + data factories.

**Definition of Done per endpoint** — route wired, input validated, service logic,
repository query (clinic-scoped), RBAC, happy-path + negative + security tests green.

---

## Module layout to add

```
src/modules/
  auth/          (exists)
  users/         users.{controller,service,repository,routes,types}.ts   — profile, dependents
  doctors/       doctor profiles, venues
  settings/      appointment_settings, message_templates (reminders), tags
  appointments/  find-slots, booking, list, status changes
  messages/      outbox + delivery worker
src/middleware/  auth, rbac, clinicScope, validate, errorHandler, rateLimit, pagination
src/utils/       slotGenerator, templateRenderer, tokenNumber, hash, response
```

---

## Phase 1 — Foundations & Auth

Goal: a request can authenticate, carry a tenant + role, and be validated/handled
consistently. Nothing else can be built or tested without this.

### Cross-cutting middleware (build first)
- `errorHandler` — maps thrown `AppError(code, status)` to the envelope.
- `validate(schema)` — zod-based body/query/params validation → 400.
- `authGuard` — verifies JWT, attaches `req.auth = {userId, clinicId, role}`.
- `requireRole(...roles)` — 403 if mismatch.
- `clinicScope` — guarantees downstream queries use `req.auth.clinicId`.
- `rateLimit` — for OTP endpoints.

### Endpoints

**POST `/auth/request-otp`** — body `{ mobile_number }`
- Generates OTP, stores **hash** + `expires_at`, sends via SMS/WhatsApp provider.
- Tests:
  - [happy] valid mobile → 200, OTP row created with hashed value, raw OTP never returned.
  - [security] repeated requests from same number → 429 after threshold.
  - [validation] malformed/empty number → 400.
  - [edge] re-request invalidates or supersedes prior unused OTP.

**POST `/auth/verify-otp`** — body `{ mobile_number, otp }`
- Verifies hash, not expired, not used, attempts < max → issues access + refresh tokens.
- Tests:
  - [happy] correct OTP → 200, tokens returned, OTP marked `used`.
  - [edge] wrong OTP → 401, `attempts` incremented.
  - [security] after N failed attempts → locked (401, no further checks).
  - [edge] expired OTP → 401.
  - [edge] already-used OTP → 401.
  - [edge] number maps to a dependent-only record → resolve to primary account rule.

**POST `/auth/refresh`** — body `{ refresh_token }`
- Validates hash + not expired + not revoked → issues new pair, **revokes old** (rotation).
- Tests:
  - [happy] valid token → new pair, old `revoked_at` set.
  - [security] reuse of revoked token → 401 (detect replay).
  - [edge] expired token → 401.

**POST `/auth/logout`** — revokes the caller's refresh token(s). Test: token unusable after.

**GET `/auth/me`** — returns current user + role + clinic. Test: [security] no token → 401.

---



## Phase 2 — Users, Dependents, Doctors, Venues

**GET `/users/me`**, **PATCH `/users/me`** — profile read/update.
- Tests: [happy] update name/address; [security] cannot change `clinic_id` or `role`.

**POST `/users/dependents`** — body `{ name, ... }` → creates user with
`parent_user_id = caller`, same `clinic_id`.
- Tests:
  - [happy] creates dependent linked to caller.
  - [security] `clinic_id` forced from token, not body.
  - [validation] name required.

**GET `/users/dependents`** — list caller's dependents.
- Tests: [happy] returns only own dependents; [security] cannot list another user's family.

**GET `/doctors/:doctorId/profile`** — speciality, qualification, fee (for booking screen).
- Tests: [happy] returns profile; [security] doctor from another clinic → 404.

**Venues CRUD** (`/venues`, staff/doctor only)
- `POST /venues`, `GET /venues`, `PATCH /venues/:id`.
- Tests: [happy] create/list within clinic; [security] patient role → 403; cross-clinic id → 404.

---

## Phase 3 — Appointment Settings & Reminder Templates

**GET `/appointment-setting?doctor_id=`**
- Returns: working periods (grouped by day, with venue), `slot_duration`,
  `max_patients_per_slot`, and reminder templates.
```json
{
  "doctor_id": "...",
  "slot_duration_minutes": 15,
  "max_patients_per_slot": 10,
  "periods": [
    { "day_of_week": 1, "start_time": "09:00", "end_time": "11:00", "venue": {...} },
    { "day_of_week": 1, "start_time": "17:00", "end_time": "21:00", "venue": {...} }
  ],
  "reminders": [
    { "type": "reminder", "offset_minutes": 1440, "subject": "...", "content": "..." }
  ]
}
```
- Tests:
  - [happy] split shift (morning + evening) returns two periods for the day.
  - [happy] reminders returned sorted by offset.
  - [security] requesting another clinic's doctor → 404.

**PUT `/appointment-setting`** (doctor/staff) — replace/upsert periods + capacity + reminders.
- Tests:
  - [happy] create multiple periods across days.
  - [validation] `start_time >= end_time` → 400.
  - [validation] `day_of_week` outside 1–7 → 400.
  - [validation] `max_patients_per_slot <= 0` or `slot_duration <= 0` → 400.
  - [edge] lowering capacity does not retro-invalidate existing appointments.

**Message templates CRUD** (`/message-templates`)
- Must support `template_type` in `reminder`, `booking_confirmation`, `appointment_cancelled`.
- Tests:
  - [happy] create cancellation template with placeholders.
  - [validation] `reminder` requires `offset_minutes`; event types must not.
  - [security] staff/doctor only.

**Tags CRUD + assignment** (can defer to Phase 7 — see below).

---

## Phase 4 — Slot Discovery (the hardest read path)

**GET `/patient/find-slots`** — query `clinic_id, doctorId, date` *or* `from, to` (≤ 1 month)
- Logic: for each date in range, find active `appointment_settings` for that
  `day_of_week`, chop each period into `slot_duration` chunks, then attach a **live
  count** of active appointments (`booked`/`finished`) at each `scheduled_start`.
```json
{
  "doctor_setting": { "slot_duration_minutes": 15, "max_patients_per_slot": 10 },
  "days": [{
    "date": "2026-06-10",
    "slots": [
      { "start": "2026-06-10T09:00:00+05:30", "end": "...",
        "capacity": 10, "booked_count": 4, "available": 6, "is_full": false,
        "venue": {...} }
    ]
  }]
}
```
- **Tests (critical — give these the most coverage):**
  - [unit] period 09:00–10:00, 15-min slots → exactly 4 slots at correct times.
  - [unit] split shift → both blocks present, no slots in the gap.
  - [unit] `booked_count` counts only `booked`+`finished`; `cancelled`/`no_show` excluded.
  - [unit] `available = capacity − booked_count`, floored at 0; `is_full` when count ≥ capacity.
  - [unit] doctor with no active setting for that weekday → that day has empty `slots`.
  - [integration] date range spanning a week returns one entry per day.
  - [edge] past date → empty (or 400 by policy — pick one and test it).
  - [edge] range > 31 days → 400.
  - [edge] timezone: a 09:00 IST slot serializes as `+05:30`, not UTC-shifted.
  - [edge] inactive setting (`is_active=false`) excluded.
  - [security] `clinic_id`/`doctorId` from another tenant → 404, no slot leakage.

---

## Phase 5 — Booking & Status Changes (the hardest write path)

**POST `/patient/:doctorId/book-appointments`** (patient or parent)
- Body `{ patient_id, scheduled_start, scheduled_end }`, header `Idempotency-Key`.
- Logic: validate slot falls inside a setting; if **patient path** and live count ≥
  `max_patients_per_slot` → 409 `SLOT_FULL` (+ suggest nearby slots); else insert
  `appointment_status='booked'`, assign per-doctor-per-day `token_number`, snapshot `venue_id`.
- Response: `{ token_number, slot_time, venue, doctor_name, doctor_speciality }`.
- **Tests:**
  - [happy] open slot → 201, status `booked`, token assigned, venue snapshotted.
  - [edge] capacity reached, patient path → 409 `SLOT_FULL` with alternatives.
  - [happy] capacity reached, **staff path** → allowed (overbook bypass).
  - [security] same `patient_id` + same `scheduled_start` twice → 409 (unique index).
  - [happy] patient cancels then rebooks same slot → allowed (cancelled excluded from index).
  - [happy] parent books two different dependents into one slot → both 201.
  - [security] booking for a `patient_id` not the caller's dependent → 403.
  - [validation] slot outside doctor working hours → 400.
  - [validation] slot in the past → 400.
  - [edge] duplicate `Idempotency-Key` replay → returns the original appointment, no second row.
  - [unit] `token_number` increments per doctor per day, resets next day.

**GET `/:doctorId/appointment-list`** — query `date` (default today), `page` (default 1),
`pageSize`, `sort` (whitelisted column)
- Response rows: `{ appointmentId, patient_name, mobile_number, address, token_number, slot_time, status }`.
- **Tests:**
  - [happy] returns today's appointments for the doctor, paginated.
  - [security] **`sort` accepts only whitelisted columns** — arbitrary string ignored/400 (SQLi guard).
  - [edge] pagination boundaries (page beyond last → empty list, correct `total`).
  - [happy] sorted by `token_number` ascending by default.
  - [security] doctor A cannot list doctor B's appointments unless same-clinic staff.
  - [security] cancelled appointments included/excluded per agreed policy — test the choice.

**PATCH `/appointments/:id/status`** (doctor/staff) — body `{ status, reason? }`
- Allowed transitions: `booked → cancelled | finished | no_show`. Writes
  `appointment_status_history`. On `cancelled`, **enqueue** a cancellation message
  (Phase 6) in the same transaction.
- **Tests:**
  - [happy] `booked → cancelled` → status updated, history row written.
  - [happy] cancellation enqueues exactly one `messages` row (`pending`) from the
    `appointment_cancelled` template, addressed to the patient.
  - [edge] cancelling an already-cancelled appointment → idempotent, **no second message**
    (guarded by `WHERE appointment_status='booked'`).
  - [validation] illegal transition (`finished → booked`) → 400.
  - [security] patient cancelling someone else's appointment → 403.
  - [happy] patient cancelling own future appointment → allowed.
  - [edge] no cancellation template configured → cancel still succeeds; log/skip message gracefully.

**Staff booking** — same booking endpoint with `staff` role; `booked_by_user_id` = staff,
`patient_id` = patient. Covered by booking tests above (overbook bypass case).

---

## Phase 6 — Messaging (outbox + worker)

**POST `/send-message`** (system/staff) — schedule or trigger a message.
- Renders template placeholders, inserts `messages` row (`pending`, `schedule_for`).
- Response: `{ message: "scheduled" }`.
- Tests:
  - [happy] inserts pending row with rendered content (placeholders filled).
  - [validation] unknown `template_type` → 400.

**Reminder scheduling** — on booking, create reminder `messages` rows at each template
`offset_minutes` before `scheduled_start`.
- Tests:
  - [unit] 3 reminders (1440/360/120 min) → `schedule_for` computed correctly from slot time.
  - [edge] booking inside a reminder window (e.g. 1h before) skips already-past reminders.
  - [edge] cancelling/rescheduling an appointment cancels its **pending** reminder rows.

**Delivery worker** (background job, not an endpoint)
- Polls `messages WHERE status='pending' AND schedule_for <= now()`, sends, marks `sent`.
- Tests:
  - [unit] picks only due pending rows.
  - [edge] provider failure → `retry_count++`, stays `pending`; after max retries → `failed`.
  - [edge] never double-sends (`sent_at`/status guard, locking).

---

## Phase 7 — Tags

**Tags CRUD** (`/tags`) + **assign/unassign** (`/users/:id/tags`).
- Auto tags (`is_auto`, `rule_definition`) e.g. "New Patient" (0 past visits) vs
  "Old Patient" (≥1) evaluated on booking/visit.
- Tests:
  - [happy] create custom tag with color; assign to patient.
  - [unit] auto-tag rule: first booking → "New Patient"; subsequent → "Old Patient".
  - [validation] duplicate tag name per clinic → 409 (unique constraint).
  - [security] tags scoped to clinic.

---

## Phase 8 — Hardening (cross-cutting test matrix)

Run these patterns against **every** endpoint:
- [security] no token → 401; expired token → 401.
- [security] wrong role → 403.
- [security] **tenant isolation** — a valid token from Clinic A cannot read/write Clinic B
  rows (expect 404, not 403, to avoid leaking existence).
- [validation] missing/extra/oversized fields → 400, never 500.
- [resilience] DB error surfaces as 500 via `errorHandler`, never a raw stack to client.
- [data] `updated_at` changes on update (trigger works); soft-deleted rows excluded from reads.

---

## Sequencing summary

```
Phase 1 (Auth + middleware)  ──► everything depends on this
Phase 2 (Users/Venues)       ──► needed for booking actors & venue snapshot
Phase 3 (Settings/Templates) ──► needed for slot generation & messages
Phase 4 (find-slots)         ──► depends on 2,3
Phase 5 (Booking/Status)     ──► depends on 4; core of the product
Phase 6 (Messaging/Worker)   ──► depends on 5 (cancellation/reminder triggers)
Phase 7 (Tags)               ──► independent, can slot in after 5
Phase 8 (Hardening)          ──► continuous, finalize before launch
```

**Suggested first vertical slice to de-risk early:** Phase 1 → minimal Phase 3 (one
working period) → Phase 4 → Phase 5 happy-path booking. That gets one patient booking one
real slot end-to-end, after which everything else is incremental.