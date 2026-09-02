# Fix: "column a.custom_status_id does not exist"

## Root Cause

The running backend container (`appointment_booking_backend`) has **newer compiled code** (in `/app/dist/`) that queries `appointments.custom_status_id` and `JOIN`s on `custom_statuses`, but:

1. The `appointments` table in the database **does not have** a `custom_status_id` column.
2. The `custom_statuses` table **does exist** with data.
3. **No migration file exists** to add `custom_status_id` to `appointments`.
4. The source code in the repo (`backend/src/`) **does not yet reference** `custom_status_id` — the compiled `dist/` is ahead of the committed source.

## Database Details

- **Container name**: `new_project_db` (NOT `appointment_booking_postgres`)
- **User**: `postgres`
- **Password**: `test123`
- **Database**: `appointment_booking`
- **Connection**: `postgresql://postgres:test123@new_project_db:5432/appointment_booking`

## What Needs to Happen

### Step 1 — Pull latest code

```bash
cd /home/dell/Documents/AppointMentBooking
git pull
```

### Step 2 — Create migration file (if not already present after pull)

Create `backend/migrations/20260902000001_add_custom_status_id_to_appointments.sql`:

```sql
-- Add custom_status_id column to appointments
-- Links appointments to the custom_statuses table for flexible status management.
-- Idempotent: safe to run multiple times.

DO $$
BEGIN
  -- Add the column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'custom_status_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN custom_status_id uuid;
  END IF;

  -- Add the foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_custom_status_id_fkey'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_custom_status_id_fkey
      FOREIGN KEY (custom_status_id) REFERENCES custom_statuses(id);
  END IF;

  -- Add an index for lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_appts_custom_status'
  ) THEN
    CREATE INDEX idx_appts_custom_status ON appointments(custom_status_id);
  END IF;
END $$;

-- Backfill: set the default status for existing appointments based on appointment_status column
UPDATE appointments a
SET custom_status_id = cs.id
FROM custom_statuses cs
WHERE a.custom_status_id IS NULL
  AND (
    (a.appointment_status = 'booked' AND cs.name = 'Waiting' AND cs.clinic_id = a.clinic_id)
    OR (a.appointment_status = 'finished' AND cs.name = 'Finished' AND cs.clinic_id = a.clinic_id)
    OR (a.appointment_status = 'cancelled' AND cs.name = 'Cancelled' AND cs.clinic_id = a.clinic_id)
    OR (a.appointment_status = 'no_show' AND cs.name = 'No-show' AND cs.clinic_id = a.clinic_id)
  );
```

### Step 3 — Rebuild backend with latest code

```bash
cd /home/dell/Documents/AppointMentBooking
docker compose up -d --build backend
```

### Step 4 — Run migration

```bash
docker exec appointment_booking_backend sh -c 'cd /app && npm run migrate:up'
```

### Step 5 — Verify the column exists

```bash
docker exec new_project_db psql -U postgres -d appointment_booking -c "\d appointments" 2>&1 | grep custom_status_id
```

### Step 6 — Verify custom_statuses table has data

```bash
docker exec new_project_db psql -U postgres -d appointment_booking -c "SELECT name, color FROM custom_statuses ORDER BY sort_order;"
```

### Step 7 — Test the dashboard query

```bash
docker exec appointment_booking_backend sh -c 'node -e "const pool=require(\"./dist/config/db.js\").default;pool.query(\"SELECT a.custom_status_id, cs.name AS status_name FROM appointments a JOIN custom_statuses cs ON cs.id = a.custom_status_id LIMIT 3\").then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"'
```

## Important Notes

- The database container is named `new_project_db`, **not** `appointment_booking_postgres`. All `docker exec` commands targeting the database must use `new_project_db` as the container name.
- The migration is idempotent (uses `IF NOT EXISTS` checks) — safe to run multiple times.
- If the source code in `backend/src/` doesn't yet reference `custom_status_id`, the dashboard queries in the running container's `dist/` folder (which are newer) will start working once the column exists.
- If after the rebuild the source code in `dist/` still doesn't have the `custom_status_id` references, you may need to ensure the TypeScript source files (dashboard.repository.ts, appointments.repository.ts, bot.repository.ts, tags.repository.ts) include the `custom_status_id` JOINs. The running container's current `dist/` already has them, so this should work as long as the build picks up the latest source.
