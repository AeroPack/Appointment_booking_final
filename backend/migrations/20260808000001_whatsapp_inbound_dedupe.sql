-- Inbound WhatsApp message de-duplication.
--
-- Meta redelivers any webhook it does not see a prompt 2xx for, and it may do
-- so concurrently. Without a claim, one retry of a slot-selection message
-- books a second appointment. The primary key is the claim: the first inserter
-- wins and every retry conflicts.
--
-- Rows are only useful for as long as Meta will retry (~24h of backoff), so
-- this table is pruned rather than kept forever.

CREATE TABLE IF NOT EXISTS whatsapp_inbound_messages (
  message_id  TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_received_at
  ON whatsapp_inbound_messages (received_at);
