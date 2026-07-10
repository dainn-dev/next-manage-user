-- V48 (DAI-263): Camera Management — first-class, site-scoped camera entity with
-- per-camera credentials (ADR-0602), durable idempotent edge ingest (docs/13 §5),
-- and heartbeat-driven online/offline (same staleness-sweep pattern as `gate`).
--
-- Everything here is tenant-scoped and joins the Deploy-2 RLS regime: the two new
-- tables get tenant_id with the session-derived DEFAULT + NOT NULL contract (same
-- as V39), and ENABLE + FORCE row-level security with the standard
-- tenant_isolation policy (same as V43). No default backfill of pre-existing rows
-- is needed — both tables are brand new.
--
-- See docs/07_Camera_Management (data model §3), ADR-0602 (credential model), and
-- docs/13_Event_Driven_Architecture §5 (idempotency via event_id).

-- ---- camera -----------------------------------------------------------------
-- A first-class camera belonging to exactly one site (tenant scoping is implicit
-- via site.tenant_id, but tenant_id is denormalized here so the RLS predicate
-- needs no join — same pattern as `gate`/`vehicle_log`, ADR-1501).
CREATE TABLE camera (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id           UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    -- zone is optional: an OVERVIEW camera may watch a whole site with no zone.
    zone_id           UUID REFERENCES zone(id) ON DELETE SET NULL,
    name              VARCHAR(150) NOT NULL,
    rtsp_url          VARCHAR(500),
    role              VARCHAR(20)  NOT NULL DEFAULT 'ANPR_GATE'
        CHECK (role IN ('ANPR_GATE', 'OVERVIEW')),
    panel_type        VARCHAR(20)
        CHECK (panel_type IS NULL OR panel_type IN ('entry', 'exit')),
    status            VARCHAR(20)  NOT NULL DEFAULT 'provisioned'
        CHECK (status IN ('provisioned', 'online', 'offline', 'disabled')),
    -- Per-camera credential (ADR-0602). Stored as a BCrypt hash, never plaintext;
    -- the raw key is returned exactly once at issuance/rotation. `previous_*`
    -- columns hold the superseded key during the rotation grace window so an edge
    -- appliance can roll its config without a hard cutover (both keys valid until
    -- previous_api_key_expires_at passes).
    api_key_hash              VARCHAR(100),
    previous_api_key_hash     VARCHAR(100),
    previous_api_key_expires_at TIMESTAMP WITH TIME ZONE,
    -- calibration_json is stored as TEXT (JSON string) not JSONB: the MVP maps it
    -- to a plain String and does no server-side JSON querying. 09_AI_Calibration
    -- owns the full shape and can migrate to JSONB when it needs indexed queries.
    calibration_json  TEXT,
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Names are unique within a site (not globally): two tenants, or two sites,
    -- may both have a "North Entry" camera.
    CONSTRAINT uq_camera_site_name UNIQUE (site_id, name),
    CONSTRAINT fk_camera_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);
CREATE INDEX idx_camera_tenant_id ON camera(tenant_id);
CREATE INDEX idx_camera_site_id   ON camera(site_id);
CREATE INDEX idx_camera_zone_id   ON camera(zone_id);
CREATE INDEX idx_camera_status    ON camera(status);

CREATE TRIGGER update_camera_updated_at BEFORE UPDATE ON camera
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- camera_ingest_event ----------------------------------------------------
-- Durable idempotency ledger for the edge ingest endpoint (docs/13 §5): the edge
-- tags every event with a client-generated event_id and re-sends from its
-- store-and-forward queue, so the SAME (camera_id, event_id) can arrive more than
-- once. The unique constraint upgrades today's in-memory GateEventDeduplicator to
-- a cross-instance, restart-surviving guard: a duplicate insert raises a unique
-- violation and the ingest API returns the original outcome without re-processing.
--
-- Dedup key is (camera_id, event_id): event_id is client-generated so it is only
-- guaranteed unique per camera, never globally. tenant_id is carried for RLS and
-- so consumers can route by tenant.
CREATE TABLE camera_ingest_event (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    camera_id    UUID NOT NULL REFERENCES camera(id) ON DELETE CASCADE,
    event_id     VARCHAR(128) NOT NULL,
    event_type   VARCHAR(40)  NOT NULL,
    occurred_at  TIMESTAMP WITH TIME ZONE,
    -- payload kept as TEXT (raw JSON string) for the MVP; the durable event store
    -- (ParkingEvent, 15_Database_Design) will carry the typed/partitioned version.
    payload      TEXT,
    snapshot_path VARCHAR(500),
    received_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_camera_event UNIQUE (camera_id, event_id),
    CONSTRAINT fk_ingest_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);
CREATE INDEX idx_ingest_tenant_id ON camera_ingest_event(tenant_id);
CREATE INDEX idx_ingest_camera_id ON camera_ingest_event(camera_id);
CREATE INDEX idx_ingest_received  ON camera_ingest_event(camera_id, received_at DESC);

-- ---- RLS: same fail-closed tenant_isolation policy as V43 --------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['camera', 'camera_ingest_event']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation ON %I
                USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
                WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        $f$, t);
    END LOOP;
END $$;

-- Grants for the RLS roles created in V43 (ALL TABLES grants there ran before
-- these tables existed, so grant explicitly).
GRANT SELECT, INSERT, UPDATE, DELETE ON camera, camera_ingest_event TO app_rls, app_admin;
