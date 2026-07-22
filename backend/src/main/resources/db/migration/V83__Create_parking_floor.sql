-- Multi-storey parking hierarchy: site -> parking_floor -> zone.
-- Existing sites receive one default floor so current single-level maps keep working.

CREATE TABLE parking_floor (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
                           REFERENCES tenant(id) ON DELETE CASCADE,
    site_id              UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    name                 VARCHAR(100) NOT NULL,
    level_number         INTEGER NOT NULL DEFAULT 0,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    background_image_url VARCHAR(1000),
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_parking_floor_site_name UNIQUE (site_id, name),
    CONSTRAINT uq_parking_floor_site_level UNIQUE (site_id, level_number)
);

CREATE INDEX idx_parking_floor_tenant_id ON parking_floor(tenant_id);
CREATE INDEX idx_parking_floor_site_id ON parking_floor(site_id);

ALTER TABLE zone
    ADD COLUMN floor_id UUID REFERENCES parking_floor(id) ON DELETE SET NULL;
CREATE INDEX idx_zone_floor_id ON zone(floor_id);

INSERT INTO parking_floor (tenant_id, site_id, name, level_number, sort_order)
SELECT tenant_id, id, 'Mặt bằng chính', 0, 0
FROM site
ON CONFLICT (site_id, level_number) DO NOTHING;

UPDATE zone z
SET floor_id = f.id
FROM parking_floor f
WHERE f.site_id = z.site_id
  AND f.level_number = 0
  AND z.floor_id IS NULL;

CREATE TRIGGER update_parking_floor_updated_at BEFORE UPDATE ON parking_floor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_floor TO app_rls, app_admin;

ALTER TABLE parking_floor ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_floor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON parking_floor
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
