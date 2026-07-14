CREATE TABLE camera_ingest_snapshot (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
                    REFERENCES tenant(id),
    event_id    UUID NOT NULL REFERENCES camera_ingest_event(id) ON DELETE CASCADE,
    kind        VARCHAR(32) NOT NULL CHECK (kind IN ('original_frame', 'plate_crop')),
    object_key  VARCHAR(500) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_camera_ingest_snapshot_kind UNIQUE(event_id, kind)
);
CREATE INDEX idx_camera_ingest_snapshot_tenant_event ON camera_ingest_snapshot(tenant_id, event_id);
ALTER TABLE camera_ingest_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_ingest_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON camera_ingest_snapshot
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON camera_ingest_snapshot TO app_rls, app_admin;
