-- Restored: this migration was applied directly against the database
-- (recorded in schema_migrations) but its file was never committed.
-- Recreated here (IF NOT EXISTS) to match the live schema.
CREATE TABLE IF NOT EXISTS flows (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id             UUID NOT NULL REFERENCES users(id),
  name                  TEXT NOT NULL,
  trigger_type          VARCHAR(50) NOT NULL DEFAULT 'book',
  is_active             BOOLEAN DEFAULT true,
  published_version_id  UUID,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id        UUID NOT NULL REFERENCES flows(id),
  version_number INTEGER NOT NULL,
  status         VARCHAR(20) NOT NULL,
  graph          JSONB NOT NULL,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  published_at   TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_flows_published_version'
  ) THEN
    ALTER TABLE flows
      ADD CONSTRAINT fk_flows_published_version
      FOREIGN KEY (published_version_id) REFERENCES flow_versions(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flows_doctor_id ON flows(doctor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_flows_doctor_trigger_active ON flows(doctor_id, trigger_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_flow_versions_flow_id ON flow_versions(flow_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_flow_versions_flow_version ON flow_versions(flow_id, version_number);
