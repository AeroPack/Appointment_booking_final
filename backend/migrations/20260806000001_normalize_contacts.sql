-- Canonicalize the login-identifier space.
--
-- Every user lookup in this codebase is an exact string match on
-- users.mobile_number / users.email, but nothing ever enforced a single format.
-- The table holds '9876543210' next to '+919876543999', so the same person can
-- hold two accounts and a signup can silently miss an existing one. There is
-- also no UNIQUE constraint anywhere, so concurrent signups can duplicate an
-- identifier outright.
--
-- This backfills every contact column to one canonical form, then adds partial
-- unique indexes so the database enforces what the application assumed.

-- Mirrors normalizePhone() in src/utils/phone.ts. Keep the two in step.
CREATE OR REPLACE FUNCTION normalize_phone(raw text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d = ''            THEN NULL
    WHEN left(d, 1) = '0'  THEN '91' || substring(d from 2)
    WHEN length(d) = 10    THEN '91' || d
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g')) AS t(d);
$$;

-- Abort rather than merge two distinct people into one identifier. Only the
-- login-identifier space matters: dependents (parent_user_id IS NOT NULL) may
-- legitimately share a parent's number and never log in themselves.
DO $$
DECLARE
  collisions text;
BEGIN
  SELECT string_agg(value, ', ') INTO collisions FROM (
    SELECT normalize_phone(mobile_number) AS value
    FROM users
    WHERE mobile_number IS NOT NULL AND deleted_at IS NULL AND parent_user_id IS NULL
    GROUP BY 1 HAVING count(*) > 1
  ) dupes;
  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Normalizing mobile numbers would merge distinct accounts: %', collisions;
  END IF;

  SELECT string_agg(value, ', ') INTO collisions FROM (
    SELECT lower(trim(email)) AS value
    FROM users
    WHERE email IS NOT NULL AND deleted_at IS NULL AND parent_user_id IS NULL
    GROUP BY 1 HAVING count(*) > 1
  ) dupes;
  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Normalizing emails would merge distinct accounts: %', collisions;
  END IF;
END $$;

UPDATE users SET mobile_number = normalize_phone(mobile_number) WHERE mobile_number IS NOT NULL;
UPDATE users SET whatsapp_number = normalize_phone(whatsapp_number) WHERE whatsapp_number IS NOT NULL;
UPDATE users SET email = lower(trim(email)) WHERE email IS NOT NULL AND email <> lower(trim(email));

-- The inbound WhatsApp webhook keys sessions by phone and previously stored a
-- '+' prefix; src/utils/phone.ts now produces bare digits. Bring existing rows
-- across so live sessions keep matching. Widget sessions store a UUID here and
-- must be left alone.
UPDATE flow_sessions
   SET channel_session_id = normalize_phone(channel_session_id)
 WHERE channel_session_id ~ '^\+?[0-9][0-9\s\-()]*$';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_mobile ON users (mobile_number)
  WHERE mobile_number IS NOT NULL AND deleted_at IS NULL AND parent_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email)
  WHERE email IS NOT NULL AND deleted_at IS NULL AND parent_user_id IS NULL;

-- Tie an OTP to the account it was issued for. Matching by raw identifier meant
-- a registration OTP sent to an email could never be found (the lookup preferred
-- the mobile branch), and a stale login OTP for the same number could satisfy a
-- registration verify. Nullable: src/modules/messages/otp.service.ts issues OTPs
-- that are not bound to a user.
ALTER TABLE otps ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_otps_user ON otps (user_id, created_at DESC);
