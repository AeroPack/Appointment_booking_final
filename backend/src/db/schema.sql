-- =============================================================================
-- APPOINTMENT BOOKING SCHEMA (PostgreSQL 13+)
-- =============================================================================
-- Notes baked into this version:
--   * gen_random_uuid() is built into PG13+ (no extension needed).
--   * All instant columns use TIMESTAMPTZ (timezone-safe). TIME columns stay
--     naive on purpose (single-timezone working hours).
--   * Booking model: capacity per slot is a SOFT, patient-facing guardrail.
--     Overbooking past the limit is allowed; staff/doctor bypass it. No counter
--     table — "how many booked" is computed live from appointments.
--   * One patient may hold only one active booking per slot (partial unique idx).
--   * Multi-location: a CLINIC is the tenant; VENUES are physical locations under
--     a clinic. A doctor works for one clinic but can practise at many venues.
--     (If true multi-tenant doctors are needed later, add a doctor_clinics M2M.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared trigger: auto-update updated_at on every UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 1. CLINICS  (tenant / organisation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS clinics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  mobile_number   VARCHAR(20),
  whatsapp_number VARCHAR(20),
  email           TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_clinics_updated ON clinics;
CREATE TRIGGER trg_clinics_updated
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 2. USERS  (doctors, staff, primary patients, and dependent family members)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  parent_user_id  UUID REFERENCES users(id),         -- NULL = primary account; set for dependents
  name            TEXT NOT NULL,
  mobile_number   VARCHAR(20),
  whatsapp_number VARCHAR(20),
  email           TEXT,
  role            VARCHAR(10) NOT NULL DEFAULT 'patient'
                    CHECK (role IN ('doctor', 'patient', 'staff')),
  gender          VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
  address         TEXT,
  date_of_birth   DATE,
  city            TEXT,
  state           TEXT,
  zip_code        VARCHAR(20),
  avatar_url      TEXT,
  relationship    VARCHAR(20),                       -- for dependents: spouse, son, daughter, parent
  is_verified     BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,                       -- soft delete (audit / data retention)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_clinic       ON users (clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_parent       ON users (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_users_mobile       ON users (mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users (clinic_id, role);

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 3. DOCTOR PROFILES  (doctor-only fields, kept out of the shared users table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctor_profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id),
  speciality          TEXT,
  qualification       TEXT,
  registration_number TEXT,
  bio                 TEXT,
  consultation_fee    NUMERIC(10,2),
  title               TEXT,
  experience_years    INT,
  patient_count       INT,
  awards_count        INT,
  publications_count  INT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_doctor_profiles_updated ON doctor_profiles;
CREATE TRIGGER trg_doctor_profiles_updated
  BEFORE UPDATE ON doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 4. VENUES  (physical locations belonging to a clinic)
-- =============================================================================
CREATE TABLE IF NOT EXISTS venues (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id),
  name       TEXT NOT NULL,            -- e.g. 'Main Clinic', 'City Hospital OPD'
  address    TEXT,
  phone      VARCHAR(20),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_clinic ON venues (clinic_id);

DROP TRIGGER IF EXISTS trg_venues_updated ON venues;
CREATE TRIGGER trg_venues_updated
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 5. APPOINTMENT SETTINGS
--    One row = one working PERIOD. Multiple rows for the same doctor + day allow
--    split shifts (e.g. 2h morning at Venue A, 4h evening at Venue B).
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointment_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id             UUID NOT NULL REFERENCES users(id),
  venue_id              UUID REFERENCES venues(id),
  day_of_week           INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Mon .. 7=Sun
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  slot_duration_minutes INT NOT NULL DEFAULT 15 CHECK (slot_duration_minutes > 0),
  max_patients_per_slot INT NOT NULL DEFAULT 10 CHECK (max_patients_per_slot > 0),
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_settings_doctor_day ON appointment_settings (doctor_id, day_of_week);

DROP TRIGGER IF EXISTS trg_settings_updated ON appointment_settings;
CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON appointment_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 6. APPOINTMENTS
--    Slots are virtual (computed from settings). venue_id is SNAPSHOTTED here so
--    later settings edits don't rewrite history. token_number = per-doctor,
--    per-day queue order, assigned by the app at booking time.
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID NOT NULL REFERENCES clinics(id),
  doctor_id          UUID NOT NULL REFERENCES users(id),
  patient_id         UUID NOT NULL REFERENCES users(id),  -- person receiving care (may be a dependent)
  booked_by_user_id  UUID NOT NULL REFERENCES users(id),  -- person who clicked "Book" (patient/parent/staff)
  venue_id           UUID REFERENCES venues(id),
  scheduled_start    TIMESTAMPTZ NOT NULL,
  scheduled_end      TIMESTAMPTZ NOT NULL,
  token_number       INT,
  appointment_status VARCHAR(12) NOT NULL DEFAULT 'booked'
                       CHECK (appointment_status IN ('booked', 'cancelled', 'finished', 'no_show')),
  notes              TEXT,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- A patient can hold only ONE active booking in a given slot (blocks self double-booking).
-- Cancelled / no_show rows are excluded, so a patient can rebook the same slot after cancelling.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_patient_per_slot
  ON appointments (patient_id, scheduled_start)
  WHERE appointment_status IN ('booked', 'finished');

CREATE INDEX IF NOT EXISTS idx_appts_doctor_start  ON appointments (doctor_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_appts_clinic        ON appointments (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appts_patient       ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appts_status        ON appointments (appointment_status);

DROP TRIGGER IF EXISTS trg_appts_updated ON appointments;
CREATE TRIGGER trg_appts_updated
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 7. APPOINTMENT STATUS HISTORY  (audit trail: who changed status, when, why)
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointment_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  old_status     VARCHAR(12),
  new_status     VARCHAR(12) NOT NULL,
  changed_by     UUID REFERENCES users(id),
  reason         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_appt ON appointment_status_history (appointment_id);


-- =============================================================================
-- 8. MESSAGE TEMPLATES
--    Holds both timed reminders (offset_minutes set) and event-triggered
--    messages like cancellation (offset_minutes NULL). doctor_id NULL = a
--    clinic-wide template. Use placeholders in content, e.g. {{patient_name}},
--    {{slot_time}}, {{doctor_name}}, {{venue}}.
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id),
  doctor_id      UUID REFERENCES users(id),
  template_type  VARCHAR(40) NOT NULL,   -- 'reminder', 'booking_confirmation', 'appointment_cancelled', ...
  subject        TEXT,
  content        TEXT NOT NULL,
  offset_minutes INT,                      -- minutes BEFORE appointment for reminders; NULL = event-triggered
  channel        VARCHAR(15) NOT NULL DEFAULT 'whatsapp'
                   CHECK (channel IN ('whatsapp', 'sms', 'email')),
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_lookup ON message_templates (clinic_id, doctor_id, template_type);

DROP TRIGGER IF EXISTS trg_templates_updated ON message_templates;
CREATE TRIGGER trg_templates_updated
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 9. MESSAGES  (outbox — a background worker delivers 'pending' rows)
--    appointment_id and sender_id are nullable to allow system / non-appointment
--    messages (e.g. automated reminders have no human sender).
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id),
  template_id    UUID REFERENCES message_templates(id),
  sender_id      UUID REFERENCES users(id),
  receiver_id    UUID NOT NULL REFERENCES users(id),
  message_name   TEXT,                    -- e.g. 'Appointment Cancelled', 'Reminder 24h'
  content        TEXT NOT NULL,           -- rendered (placeholders already filled)
  channel        VARCHAR(15) NOT NULL DEFAULT 'whatsapp'
                   CHECK (channel IN ('whatsapp', 'sms', 'email')),
  schedule_for   TIMESTAMPTZ,             -- when it should be sent (NOW() = immediate)
  status         VARCHAR(10) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count    INT NOT NULL DEFAULT 0,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_appointment ON messages (appointment_id);
CREATE INDEX IF NOT EXISTS idx_messages_worker      ON messages (status, schedule_for);  -- worker poll path

DROP TRIGGER IF EXISTS trg_messages_updated ON messages;
CREATE TRIGGER trg_messages_updated
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 10. TAGS  +  USER_TAGS  (patient labelling, e.g. 'New Patient', 'Old Patient')
--     is_auto + rule_definition support condition-based auto-tagging; manual tags
--     are assigned via user_tags.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  name            TEXT NOT NULL,
  color           VARCHAR(9),             -- hex e.g. '#FF8800'
  is_system       BOOLEAN DEFAULT false,  -- default/built-in tags vs custom
  is_auto         BOOLEAN DEFAULT false,  -- rule-driven vs manually assigned
  rule_definition JSONB,                  -- conditions for auto tags (e.g. visit count thresholds)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clinic_id, name)
);

DROP TRIGGER IF EXISTS trg_tags_updated ON tags;
CREATE TRIGGER trg_tags_updated
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_tags (
  user_id     UUID NOT NULL REFERENCES users(id),
  tag_id      UUID NOT NULL REFERENCES tags(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_tag ON user_tags (tag_id);


-- =============================================================================
-- 11. OTPS  (login via mobile or email)  — store a HASH, not the raw code;
--     lock after N tries.  Exactly one of mobile_number / email must be set.
-- =============================================================================
CREATE TABLE IF NOT EXISTS otps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number VARCHAR(20),
  email         TEXT,
  otp_hash      TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts      INT NOT NULL DEFAULT 0,
  used          BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT otps_identifier_check CHECK (mobile_number IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_otps_mobile ON otps (mobile_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otps_email  ON otps (email, created_at DESC);


-- =============================================================================
-- 12. REFRESH TOKENS (JWT auth) — store a HASH; revocable for logout/rotation
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens (expires_at);


-- =============================================================================
-- 13. BOOKING IDEMPOTENCY  (prevents duplicate bookings on retry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS booking_idempotency (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  appointment_id  UUID NOT NULL REFERENCES appointments(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================================================
-- 14. CHATBOT CONFIGURATION  (per-doctor widget settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctor_chatbot_config (
  doctor_id     UUID PRIMARY KEY REFERENCES users(id),
  is_enabled    BOOLEAN DEFAULT false,
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  greeting_msg  TEXT DEFAULT 'Hi! How can I help you today?',
  position      VARCHAR(20) DEFAULT 'bottom-right',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_doctor_chatbot_config_updated ON doctor_chatbot_config;
CREATE TRIGGER trg_doctor_chatbot_config_updated
  BEFORE UPDATE ON doctor_chatbot_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 15. DOCTOR FAQ  (Q&A pairs for chatbot)
-- =============================================================================
CREATE TABLE IF NOT EXISTS doctor_faq (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID NOT NULL REFERENCES users(id),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  keywords   TEXT[] DEFAULT '{}',
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_faq_doctor_id ON doctor_faq(doctor_id);