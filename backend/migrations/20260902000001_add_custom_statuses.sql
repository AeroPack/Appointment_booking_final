-- Add custom_status_id column to appointments.
-- Migrates from the old appointment_status text column to the new
-- custom_status_id UUID foreign key referencing custom_statuses.
-- Idempotent: safe to run multiple times.

DO $$
BEGIN
  -- 1. Add the column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'custom_status_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN custom_status_id uuid;
  END IF;

  -- 2. Add the foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_custom_status_id_fkey'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_custom_status_id_fkey
      FOREIGN KEY (custom_status_id) REFERENCES custom_statuses(id);
  END IF;

  -- 3. Add an index for lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_appts_custom_status'
  ) THEN
    CREATE INDEX idx_appts_custom_status ON appointments(custom_status_id);
  END IF;
END $$;

-- 4. Backfill: set the default status for existing appointments
--    based on the old appointment_status text column (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'appointment_status'
  ) THEN
    UPDATE appointments a
    SET custom_status_id = cs.id
    FROM custom_statuses cs
    WHERE a.custom_status_id IS NULL
      AND (
        (a.appointment_status = 'booked'    AND cs.name = 'Waiting'   AND cs.clinic_id = a.clinic_id)
        OR (a.appointment_status = 'finished'  AND cs.name = 'Finished'  AND cs.clinic_id = a.clinic_id)
        OR (a.appointment_status = 'cancelled' AND cs.name = 'Cancelled' AND cs.clinic_id = a.clinic_id)
        OR (a.appointment_status = 'no_show'   AND cs.name = 'No-show'   AND cs.clinic_id = a.clinic_id)
      );
  ELSE
    -- No old column: backfill all as Waiting
    UPDATE appointments a
    SET custom_status_id = cs.id
    FROM custom_statuses cs
    WHERE a.custom_status_id IS NULL
      AND cs.name = 'Waiting'
      AND cs.clinic_id = a.clinic_id;
  END IF;
END $$;

-- 5. Set NOT NULL after backfill (only if all rows have a value)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM appointments WHERE custom_status_id IS NULL) THEN
    ALTER TABLE appointments ALTER COLUMN custom_status_id SET NOT NULL;
  END IF;
END $$;

-- 6. Drop old appointment_status column if it exists
ALTER TABLE appointments DROP COLUMN IF EXISTS appointment_status;

-- 7. Ensure appointment_status_history uses UUID columns (not text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_status_history'
      AND column_name = 'old_status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE appointment_status_history ADD COLUMN old_status_uuid UUID;
    UPDATE appointment_status_history ash
    SET old_status_uuid = cs.id
    FROM custom_statuses cs
    WHERE cs.name = ash.old_status;
    ALTER TABLE appointment_status_history DROP COLUMN old_status;
    ALTER TABLE appointment_status_history RENAME COLUMN old_status_uuid TO old_status;
    ALTER TABLE appointment_status_history
      ADD CONSTRAINT fk_status_history_old
        FOREIGN KEY (old_status) REFERENCES custom_statuses(id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointment_status_history'
      AND column_name = 'new_status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE appointment_status_history ADD COLUMN new_status_uuid UUID;
    UPDATE appointment_status_history ash
    SET new_status_uuid = cs.id
    FROM custom_statuses cs
    WHERE cs.name = ash.new_status;
    ALTER TABLE appointment_status_history DROP COLUMN new_status;
    ALTER TABLE appointment_status_history RENAME COLUMN new_status_uuid TO new_status;
    ALTER TABLE appointment_status_history
      ALTER COLUMN new_status SET NOT NULL;
    ALTER TABLE appointment_status_history
      ADD CONSTRAINT fk_status_history_new
        FOREIGN KEY (new_status) REFERENCES custom_statuses(id);
  END IF;
END $$;
