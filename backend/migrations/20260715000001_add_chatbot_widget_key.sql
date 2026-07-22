-- Restored: this migration was applied directly against the database
-- (recorded in schema_migrations) but its file was never committed.
-- Recreated here (IF NOT EXISTS / additive only) to match the live schema.
ALTER TABLE doctor_chatbot_config
  ADD COLUMN IF NOT EXISTS widget_key UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS typebot_embed_snippet TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_chatbot_config_widget_key
  ON doctor_chatbot_config(widget_key);
