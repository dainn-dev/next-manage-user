-- V36: Multi-tenant foundation (Deploy 1) — root tenancy tables.
--
-- Creates the tenant -> site -> zone hierarchy and seeds a DEFAULT tenant + site
-- that every pre-multi-tenant row is backfilled under (V37 adds the columns and
-- backfills existing rows via a constant column DEFAULT, V39 enforces NOT NULL +
-- FK). No Row-Level Security is enabled here: RLS is forced only in Deploy 2 (V43)
-- *after* the TenantContextFilter + transaction-local set_config('app.tenant_id', …)
-- propagation ships and P3 (existing single-tenant flows unchanged) is verified.
-- See DAI-261 tech spec §3.
--
-- The seeded UUIDs are fixed and well-known; they MUST match
-- com.vehiclemanagement.config.TenantContext.DEFAULT_TENANT_ID and the
-- DEFAULT_SITE id used by the V37 backfill.

-- tenant: the tenancy root. It has no tenant_id column (it *is* the tenant);
-- the Deploy 2 RLS policy keys on id = current_setting('app.tenant_id'). The
-- status lifecycle (incl. 'pending_deletion') is the hook the deferred GDPR
-- delete work (R4) will use — no delete logic is implemented in this issue.
CREATE TABLE tenant (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(150) NOT NULL,
    slug       VARCHAR(100) NOT NULL UNIQUE,
    status     VARCHAR(32)  NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'pending_deletion')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- site: a tenant's physical location. Carries tenant_id denormalized so the
-- Deploy 2 RLS predicate needs no join (ADR-1501).
CREATE TABLE site (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name       VARCHAR(150) NOT NULL,
    location   VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_site_tenant_name UNIQUE (tenant_id, name)
);
CREATE INDEX idx_site_tenant_id ON site(tenant_id);

-- zone: a sub-area within a site. Carries both tenant_id and site_id denormalized.
CREATE TABLE zone (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    site_id    UUID NOT NULL REFERENCES site(id)   ON DELETE CASCADE,
    name       VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_zone_site_name UNIQUE (site_id, name)
);
CREATE INDEX idx_zone_tenant_id ON zone(tenant_id);
CREATE INDEX idx_zone_site_id   ON zone(site_id);

-- Seed the DEFAULT tenant + site under fixed, well-known UUIDs.
INSERT INTO tenant (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO site (id, tenant_id, name, location)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001', 'Default Site', 'Default')
ON CONFLICT (id) DO NOTHING;

-- Reuse the shared updated_at trigger function (defined in V1).
CREATE TRIGGER update_tenant_updated_at BEFORE UPDATE ON tenant
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_site_updated_at BEFORE UPDATE ON site
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zone_updated_at BEFORE UPDATE ON zone
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
