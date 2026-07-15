-- DAI-321: tenant-isolated analytics projections. Dashboard queries read only
-- these tables; parking_event remains the replayable source of truth.
CREATE TABLE analytics_site_daily (
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    entries BIGINT NOT NULL DEFAULT 0,
    exits BIGINT NOT NULL DEFAULT 0,
    completed_sessions BIGINT NOT NULL DEFAULT 0,
    total_dwell_seconds NUMERIC(20,3) NOT NULL DEFAULT 0,
    rebuilt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, site_id, bucket_date)
);

CREATE TABLE analytics_vehicle_daily (
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    license_plate VARCHAR(32) NOT NULL,
    visits BIGINT NOT NULL DEFAULT 0,
    rebuilt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, site_id, bucket_date, license_plate)
);

CREATE TABLE analytics_slot_daily (
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    bucket_date DATE NOT NULL,
    slot_id UUID NOT NULL REFERENCES parking_slot(id) ON DELETE CASCADE,
    occupied_seconds NUMERIC(20,3) NOT NULL DEFAULT 0,
    visits BIGINT NOT NULL DEFAULT 0,
    rebuilt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, site_id, bucket_date, slot_id)
);

CREATE TABLE analytics_projection_checkpoint (
    name VARCHAR(80) PRIMARY KEY,
    source_event_count BIGINT NOT NULL,
    source_max_occurred_at TIMESTAMP WITH TIME ZONE,
    rebuilt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_site_daily_range ON analytics_site_daily(tenant_id, site_id, bucket_date);
CREATE INDEX idx_analytics_vehicle_daily_range ON analytics_vehicle_daily(tenant_id, site_id, bucket_date);
CREATE INDEX idx_analytics_slot_daily_range ON analytics_slot_daily(tenant_id, site_id, bucket_date);

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['analytics_site_daily','analytics_vehicle_daily','analytics_slot_daily']
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

GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_site_daily, analytics_vehicle_daily,
    analytics_slot_daily TO app_rls, app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_projection_checkpoint TO app_admin;
