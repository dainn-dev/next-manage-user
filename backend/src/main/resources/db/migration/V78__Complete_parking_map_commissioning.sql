-- DAI-326: complete the approved draft -> validate -> publish commissioning contract.
-- Composite reference keys let foreign keys prove that every relationship stays
-- inside one tenant/site instead of relying on application-side UUID checks.
CREATE UNIQUE INDEX uq_site_commissioning_scope ON site(id,tenant_id);
CREATE UNIQUE INDEX uq_camera_commissioning_scope ON camera(id,tenant_id,site_id);
CREATE UNIQUE INDEX uq_zone_commissioning_scope ON zone(id,tenant_id,site_id);
CREATE UNIQUE INDEX uq_user_commissioning_scope ON users(id,tenant_id);
CREATE UNIQUE INDEX uq_map_commissioning_scope ON site_map_version(id,tenant_id,site_id,camera_id);
CREATE UNIQUE INDEX uq_slot_commissioning_scope ON parking_slot(id,tenant_id,site_id);

CREATE TABLE parking_map_source_image (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id),
    site_id UUID NOT NULL,
    camera_id UUID NOT NULL,
    object_key VARCHAR(1000) NOT NULL,
    content_type VARCHAR(80) NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    sha256 CHAR(64) NOT NULL,
    native_width INTEGER NOT NULL CHECK (native_width > 0),
    native_height INTEGER NOT NULL CHECK (native_height > 0),
    capture_method VARCHAR(20) NOT NULL CHECK (capture_method IN ('upload','camera')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_parking_map_source_object UNIQUE(tenant_id, object_key),
    CONSTRAINT fk_map_source_site_scope FOREIGN KEY(site_id,tenant_id)
        REFERENCES site(id,tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_map_source_camera_scope FOREIGN KEY(camera_id,tenant_id,site_id)
        REFERENCES camera(id,tenant_id,site_id) ON DELETE RESTRICT,
    CONSTRAINT fk_map_source_actor_scope FOREIGN KEY(created_by,tenant_id)
        REFERENCES users(id,tenant_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_map_source_commissioning_scope
    ON parking_map_source_image(id,tenant_id,site_id,camera_id);

ALTER TABLE camera_calibration_version
    ADD COLUMN source_image_id UUID;

ALTER TABLE camera_calibration_version
    ADD CONSTRAINT chk_calibration_coordinate_space
        CHECK (coordinate_space='site-local-meters-v1');

CREATE UNIQUE INDEX uq_calibration_commissioning_scope
    ON camera_calibration_version(id,tenant_id,site_id,camera_id);

ALTER TABLE camera_calibration_version
    ADD CONSTRAINT fk_calibration_source_scope
        FOREIGN KEY(source_image_id,tenant_id,site_id,camera_id)
        REFERENCES parking_map_source_image(id,tenant_id,site_id,camera_id) ON DELETE RESTRICT;

ALTER TABLE site_map_version
    ADD COLUMN source_image_id UUID,
    ADD COLUMN coverage_pixel_vertices JSONB,
    ADD COLUMN coverage_polygon geometry(Polygon, 0),
    ADD COLUMN archived_by UUID,
    ADD COLUMN publish_idempotency_key VARCHAR(100);

ALTER TABLE site_map_version
    ADD CONSTRAINT fk_map_camera_scope FOREIGN KEY(camera_id,tenant_id,site_id)
        REFERENCES camera(id,tenant_id,site_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_map_source_scope FOREIGN KEY(source_image_id,tenant_id,site_id,camera_id)
        REFERENCES parking_map_source_image(id,tenant_id,site_id,camera_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_map_calibration_scope FOREIGN KEY(calibration_version_id,tenant_id,site_id,camera_id)
        REFERENCES camera_calibration_version(id,tenant_id,site_id,camera_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_map_archived_actor_scope FOREIGN KEY(archived_by,tenant_id)
        REFERENCES users(id,tenant_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_map_published_actor_scope FOREIGN KEY(published_by,tenant_id)
        REFERENCES users(id,tenant_id) ON DELETE RESTRICT;

ALTER TABLE parking_slot ADD COLUMN authoring_camera_id UUID;
CREATE UNIQUE INDEX uq_slot_camera_commissioning_scope
    ON parking_slot(id,tenant_id,site_id,authoring_camera_id);
ALTER TABLE parking_slot
    ADD CONSTRAINT fk_slot_authoring_camera_scope
        FOREIGN KEY(authoring_camera_id,tenant_id,site_id)
        REFERENCES camera(id,tenant_id,site_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_site_camera_draft_map ON site_map_version(site_id, camera_id)
    WHERE status='draft';
CREATE UNIQUE INDEX uq_map_publish_idempotency ON site_map_version(tenant_id, publish_idempotency_key)
    WHERE publish_idempotency_key IS NOT NULL;

CREATE TABLE parking_map_draft_slot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id),
    site_id UUID NOT NULL,
    camera_id UUID NOT NULL,
    map_version_id UUID NOT NULL,
    slot_id UUID,
    zone_id UUID,
    code VARCHAR(20) NOT NULL,
    admin_status VARCHAR(20) NOT NULL DEFAULT 'enabled'
        CHECK (admin_status IN ('enabled','disabled','retired')),
    pixel_vertices JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_draft_logical_slot UNIQUE(map_version_id, slot_id),
    CONSTRAINT fk_draft_map_scope FOREIGN KEY(map_version_id,tenant_id,site_id,camera_id)
        REFERENCES site_map_version(id,tenant_id,site_id,camera_id) ON DELETE CASCADE,
    CONSTRAINT fk_draft_slot_scope FOREIGN KEY(slot_id,tenant_id,site_id,camera_id)
        REFERENCES parking_slot(id,tenant_id,site_id,authoring_camera_id) ON DELETE RESTRICT,
    CONSTRAINT fk_draft_zone_scope FOREIGN KEY(zone_id,tenant_id,site_id)
        REFERENCES zone(id,tenant_id,site_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_draft_slot_code_ci
    ON parking_map_draft_slot(map_version_id,lower(btrim(code)));

ALTER TABLE parking_slot_geometry
    ADD COLUMN source_camera_id UUID,
    ADD COLUMN pixel_vertices JSONB;

ALTER TABLE parking_slot_geometry
    ADD CONSTRAINT fk_geometry_source_camera_scope
        FOREIGN KEY(source_camera_id,tenant_id,site_id)
        REFERENCES camera(id,tenant_id,site_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_geometry_map_scope
        FOREIGN KEY(map_version_id,tenant_id,site_id,source_camera_id)
        REFERENCES site_map_version(id,tenant_id,site_id,camera_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_geometry_slot_scope
        FOREIGN KEY(slot_id,tenant_id,site_id,source_camera_id)
        REFERENCES parking_slot(id,tenant_id,site_id,authoring_camera_id) ON DELETE CASCADE;

CREATE TABLE parking_map_activation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id),
    site_id UUID NOT NULL,
    camera_id UUID NOT NULL,
    map_version_id UUID NOT NULL,
    previous_map_version_id UUID,
    action VARCHAR(20) NOT NULL CHECK (action IN ('publish','archive','rollback')),
    reason VARCHAR(500),
    actor_id UUID,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activation_camera_scope FOREIGN KEY(camera_id,tenant_id,site_id)
        REFERENCES camera(id,tenant_id,site_id) ON DELETE RESTRICT,
    CONSTRAINT fk_activation_map_scope FOREIGN KEY(map_version_id,tenant_id,site_id,camera_id)
        REFERENCES site_map_version(id,tenant_id,site_id,camera_id) ON DELETE RESTRICT,
    CONSTRAINT fk_activation_previous_map_scope FOREIGN KEY(previous_map_version_id,tenant_id,site_id,camera_id)
        REFERENCES site_map_version(id,tenant_id,site_id,camera_id) ON DELETE RESTRICT,
    CONSTRAINT fk_activation_actor_scope FOREIGN KEY(actor_id,tenant_id)
        REFERENCES users(id,tenant_id) ON DELETE RESTRICT
);

CREATE INDEX idx_map_source_site_camera ON parking_map_source_image(tenant_id,site_id,camera_id,created_at DESC);
CREATE INDEX idx_map_draft_slot_map ON parking_map_draft_slot(tenant_id,site_id,map_version_id);
CREATE INDEX idx_map_coverage ON site_map_version USING GIST(coverage_polygon);
CREATE INDEX idx_map_activation_site ON parking_map_activation_audit(tenant_id,site_id,occurred_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['parking_map_source_image','parking_map_draft_slot','parking_map_activation_audit'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
  END LOOP;
END $$;

GRANT SELECT,INSERT ON parking_map_source_image,parking_map_activation_audit TO app_rls,app_admin;
GRANT SELECT,INSERT,UPDATE,DELETE ON parking_map_draft_slot TO app_rls,app_admin;
