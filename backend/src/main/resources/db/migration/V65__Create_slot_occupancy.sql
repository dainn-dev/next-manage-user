CREATE TABLE slot_occupancy (
    slot_id       UUID PRIMARY KEY REFERENCES parking_slot(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id       UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    zone_id       UUID REFERENCES zone(id) ON DELETE SET NULL,
    status        VARCHAR(10) NOT NULL CHECK (status IN ('free', 'occupied')),
    track_id      VARCHAR(255),
    plate         VARCHAR(32),
    last_seen_at  TIMESTAMP WITH TIME ZONE,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_slot_occupancy_payload CHECK (
        (status = 'free' AND track_id IS NULL AND plate IS NULL)
        OR (status = 'occupied' AND track_id IS NOT NULL AND last_seen_at IS NOT NULL)
    )
);

CREATE INDEX idx_slot_occupancy_tenant_site_zone ON slot_occupancy(tenant_id, site_id, zone_id);
ALTER TABLE slot_occupancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_occupancy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON slot_occupancy
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON slot_occupancy TO app_rls, app_admin;
