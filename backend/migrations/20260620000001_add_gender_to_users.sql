-- Add gender column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other'));
