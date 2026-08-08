-- Add per-clinic webhook secret for WhatsApp inbound webhook authentication.
-- Mirrors the widget_key pattern in 20260715000001_add_chatbot_widget_key.sql.
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS whatsapp_webhook_secret UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_whatsapp_webhook_secret
  ON clinics(whatsapp_webhook_secret);
