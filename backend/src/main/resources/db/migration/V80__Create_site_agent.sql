-- V80: Site Agent Management — desktop application identity and lifecycle
--
-- A site_agent represents a Tauri desktop application paired with exactly one site.
-- The agent polls configuration, spawns camera workers, and reports health.
-- Multiple agents per site are allowed for future primary/standby support, but MVP
-- enforces one active agent per site via application logic.
--
-- Tenant-scoped with RLS following the same pattern as V48 (camera).

CREATE TABLE site_agent (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    site_id                 UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    name                    VARCHAR(150) NOT NULL,
    -- Device fingerprint (hashed) helps detect duplicate enrollments and device changes
    device_fingerprint_hash VARCHAR(100) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'provisioning'
        CHECK (status IN ('provisioning', 'online', 'offline', 'revoked')),
    -- Version and platform for compatibility checks and diagnostics
    version                 VARCHAR(50),
    platform                VARCHAR(100),
    -- Health tracking
    last_heartbeat_at       TIMESTAMP WITH TIME ZONE,
    last_ip                 INET,
    -- Capabilities for future feature detection (CPU/GPU/model support)
    capabilities_json       TEXT,
    -- Audit timestamps
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at              TIMESTAMP WITH TIME ZONE,
    -- Name uniqueness within site (not globally)
    CONSTRAINT uq_agent_site_name UNIQUE (site_id, name),
    CONSTRAINT fk_agent_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);

CREATE INDEX idx_agent_tenant_id ON site_agent(tenant_id);
CREATE INDEX idx_agent_site_id ON site_agent(site_id);
CREATE INDEX idx_agent_status ON site_agent(status) WHERE status != 'revoked';
CREATE INDEX idx_agent_heartbeat ON site_agent(last_heartbeat_at) WHERE status = 'online';

CREATE TRIGGER update_site_agent_updated_at BEFORE UPDATE ON site_agent
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: same tenant_isolation policy as camera (V48)
ALTER TABLE site_agent ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_agent FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON site_agent
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Grants for RLS roles (same as V48)
GRANT SELECT, INSERT, UPDATE, DELETE ON site_agent TO app_rls, app_admin;
