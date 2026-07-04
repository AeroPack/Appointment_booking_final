-- Add email support to otps table for email-based verification
ALTER TABLE otps ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE otps ALTER COLUMN mobile_number DROP NOT NULL;
ALTER TABLE otps ADD CONSTRAINT otps_identifier_check
  CHECK (mobile_number IS NOT NULL OR email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email, created_at DESC);
