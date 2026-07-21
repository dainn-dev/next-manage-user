-- V81: Site Agent Credentials — device token lifecycle with rotation support
--
-- Stores BCrypt-hashed refresh tokens for agent authentication. Access tokens are
-- short-lived JWTs and not persisted. Each agent can have multiple active credentials
-- during rotation to avoid downtime.

CREATE TABLE site_agent_credential (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    agent_id         UUID NOT NULL REFERENCES site_agent(id) ON DELETE CASCADE,
    -- BCrypt hash of the refresh token (never plaintext)
    token_hash       VARCHAR(100) NOT NULL,
    -- Token lifecycle timestamps
    expires_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at     TIMESTAMP WITH TIME ZONE,
    rotated_at       TIMESTAMP WITH TIME ZONE,
    revoked_at       TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_credential_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);

CREATE INDEX idx_credential_tenant_id ON site_agent_credential(tenant_id);
CREATE INDEX idx_credential_agent_id ON site_agent_credential(agent_id);
-- Query active credentials efficiently
CREATE INDEX idx_credential_active ON site_agent_credential(agent_id, expires_at)
    WHERE revoked_at IS NULL;

-- RLS: same tenant_isolation policy
ALTER TABLE site_agent_credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_agent_credential FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON site_agent_credential
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON site_agent_credential TO app_rls, app_admin;
