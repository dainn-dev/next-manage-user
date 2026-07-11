-- Phase D (ADR-0604): tenant registers plates into management; one platform vehicle
-- (unique plate) may be registered at many closed tenants. Open retail stays visit-only.

CREATE TABLE tenant_vehicle_registration (
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    site_id    UUID NULL REFERENCES site(id) ON DELETE SET NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (vehicle_id, tenant_id),
    CONSTRAINT tenant_vehicle_registration_status_check
        CHECK (status IN ('ACTIVE', 'REVOKED'))
);

CREATE INDEX idx_tvr_tenant_id ON tenant_vehicle_registration(tenant_id);
CREATE INDEX idx_tvr_vehicle_id ON tenant_vehicle_registration(vehicle_id);
CREATE INDEX idx_tvr_status ON tenant_vehicle_registration(status);

COMMENT ON TABLE tenant_vehicle_registration IS
    'Closed-org whitelist: plate (platform vehicles row) registered for management at a tenant. ADR-0604.';

ALTER TABLE tenant_vehicle_registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_vehicle_registration FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_vehicle_registration
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_vehicle_registration TO app_rls, app_admin;

-- Every existing vehicle is registered at its home tenant.
INSERT INTO tenant_vehicle_registration (vehicle_id, tenant_id, site_id, status, created_at, updated_at)
SELECT v.id, v.tenant_id, v.current_site_id, 'ACTIVE', COALESCE(v.created_at, NOW()), NOW()
FROM vehicles v
WHERE v.tenant_id IS NOT NULL
ON CONFLICT (vehicle_id, tenant_id) DO NOTHING;

-- Vehicles visible to a tenant if home tenant_id matches (legacy) OR an ACTIVE registration exists.
DROP POLICY IF EXISTS tenant_isolation ON vehicles;
CREATE POLICY tenant_isolation ON vehicles
    USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR EXISTS (
            SELECT 1
            FROM tenant_vehicle_registration tvr
            WHERE tvr.vehicle_id = vehicles.id
              AND tvr.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
              AND tvr.status = 'ACTIVE'
        )
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR EXISTS (
            SELECT 1
            FROM tenant_vehicle_registration tvr
            WHERE tvr.vehicle_id = vehicles.id
              AND tvr.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
    );
