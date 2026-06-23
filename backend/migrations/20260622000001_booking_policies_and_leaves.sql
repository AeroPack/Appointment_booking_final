-- Add booking policy columns to doctor_profiles
ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS booking_min_notice_hours INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS booking_max_advance_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS auto_confirm_bookings BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancellation_window_hours INT NOT NULL DEFAULT 24;

-- Doctor leaves table for vacation / time-off
CREATE TABLE IF NOT EXISTS doctor_leaves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES users(id),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_doctor_leaves_doctor ON doctor_leaves (doctor_id, start_date);

DROP TRIGGER IF EXISTS trg_doctor_leaves_updated ON doctor_leaves;
CREATE TRIGGER trg_doctor_leaves_updated
  BEFORE UPDATE ON doctor_leaves
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
