-- Migration: Add password_reset_otps table for forgot password flow
-- This table tracks password reset OTP requests separately from login OTPs

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  mobile_number VARCHAR(20),
  email TEXT,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_password_reset_contact CHECK (mobile_number IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_otps (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_mobile ON password_reset_otps (mobile_number);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_otps (email);

COMMENT ON TABLE password_reset_otps IS 'Stores OTP codes for password reset requests';
COMMENT ON COLUMN password_reset_otps.otp_hash IS 'SHA-256 hash of the 6-digit OTP';
COMMENT ON COLUMN password_reset_otps.used IS 'Whether this OTP has been consumed';
