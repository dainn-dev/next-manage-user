-- DAI-324: per-camera authoring, immutable calibration, and optimistic map publishing.
ALTER TABLE site_map_version DROP CONSTRAINT IF EXISTS site_map_version_status_check;
ALTER TABLE site_map_version
    ADD COLUMN camera_id UUID REFERENCES camera(id) ON DELETE RESTRICT,
    ADD COLUMN source_image_url VARCHAR(1000),
    ADD COLUMN source_image_width INTEGER CHECK (source_image_width > 0),
    ADD COLUMN source_image_height INTEGER CHECK (source_image_height > 0),
    ADD COLUMN lock_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE,
    ADD CONSTRAINT site_map_version_status_check
        CHECK (status IN ('draft', 'published', 'archived', 'retired'));

DROP INDEX IF EXISTS uq_site_map_version_published;
ALTER TABLE site_map_version DROP CONSTRAINT IF EXISTS uq_site_map_version_number;
CREATE UNIQUE INDEX uq_site_camera_map_version_number
    ON site_map_version(site_id, camera_id, version_number);
CREATE UNIQUE INDEX uq_site_camera_published_map
    ON site_map_version(site_id, camera_id)
    WHERE status = 'published';
CREATE UNIQUE INDEX uq_site_legacy_published_map
    ON site_map_version(site_id)
    WHERE status = 'published' AND camera_id IS NULL;

CREATE TABLE camera_calibration_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES camera(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    coordinate_space VARCHAR(64) NOT NULL DEFAULT 'site-local-meters-v1',
    control_points JSONB NOT NULL,
    homography DOUBLE PRECISION[] NOT NULL,
    reprojection_error DOUBLE PRECISION NOT NULL CHECK (reprojection_error >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'stale', 'invalid')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_camera_calibration_version UNIQUE(camera_id, version_number),
    CONSTRAINT chk_homography_size CHECK (cardinality(homography) = 9)
);

ALTER TABLE site_map_version
    ADD COLUMN calibration_version_id UUID REFERENCES camera_calibration_version(id) ON DELETE RESTRICT;

ALTER TABLE camera_calibration_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_calibration_version FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON camera_calibration_version
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON camera_calibration_version TO app_rls, app_admin;

CREATE INDEX idx_calibration_tenant_site_camera
    ON camera_calibration_version(tenant_id, site_id, camera_id);
CREATE INDEX idx_map_version_camera_status
    ON site_map_version(tenant_id, site_id, camera_id, status);
