-- DAI-298: authoritative, site-local parking-slot geometry used by the
-- backend point-in-polygon mapper. Geometry is deliberately SRID 0 because it
-- lives in the calibrated site-local metre plane, never latitude/longitude.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE site_map_version (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id             UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL CHECK (version_number > 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'retired')),
    coordinate_space    VARCHAR(64) NOT NULL DEFAULT 'site-local-meters-v1'
                        CHECK (coordinate_space = 'site-local-meters-v1'),
    calibration_version VARCHAR(255),
    published_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_site_map_version_number UNIQUE (site_id, version_number)
);

-- A site exposes one authoritative map at a time. Drafts and retired maps stay
-- available for editing/audit but are excluded from runtime matching.
CREATE UNIQUE INDEX uq_site_map_version_published
    ON site_map_version(site_id)
    WHERE status = 'published';
CREATE INDEX idx_site_map_version_tenant_site
    ON site_map_version(tenant_id, site_id);

CREATE TABLE parking_slot (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id      UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    zone_id      UUID REFERENCES zone(id) ON DELETE SET NULL,
    code         VARCHAR(20) NOT NULL,
    admin_status VARCHAR(20) NOT NULL DEFAULT 'enabled'
                 CHECK (admin_status IN ('enabled', 'disabled', 'retired')),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_parking_slot_site_code_active
    ON parking_slot(site_id, lower(btrim(code)))
    WHERE admin_status <> 'retired';
CREATE INDEX idx_parking_slot_tenant_site_zone
    ON parking_slot(tenant_id, site_id, zone_id)
    WHERE admin_status = 'enabled';

CREATE TRIGGER update_parking_slot_updated_at BEFORE UPDATE ON parking_slot
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE parking_slot_geometry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id        UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    slot_id        UUID NOT NULL REFERENCES parking_slot(id) ON DELETE CASCADE,
    map_version_id UUID NOT NULL REFERENCES site_map_version(id) ON DELETE CASCADE,
    polygon        geometry(Polygon, 0) NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_parking_slot_geometry_revision UNIQUE (slot_id, map_version_id),
    CONSTRAINT chk_parking_slot_geometry_valid CHECK (
        ST_SRID(polygon) = 0
        AND ST_IsValid(polygon)
        AND ST_IsSimple(polygon)
        AND ST_Area(polygon) > 0
    )
);

-- The GiST index is used by the bounding-box prefilter before ST_Covers does
-- the authoritative boundary-inclusive point-in-polygon test.
CREATE INDEX idx_parking_slot_geometry_polygon
    ON parking_slot_geometry USING GIST (polygon);
CREATE INDEX idx_parking_slot_geometry_tenant_site_map
    ON parking_slot_geometry(tenant_id, site_id, map_version_id);

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'site_map_version', 'parking_slot', 'parking_slot_geometry'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format($policy$
            CREATE POLICY tenant_isolation ON %I
                USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
                WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        $policy$, table_name);
    END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON site_map_version, parking_slot, parking_slot_geometry
    TO app_rls, app_admin;
