-- Migration: Add password_hash to users table for password-based authentication
-- This migration adds support for password login alongside OTP authentication

ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Add index for faster email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Add comment for clarity
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password for password-based authentication';
