-- Reintroduce SITE_MANAGER and persist per-user site membership for JWT site_ids.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER', 'MEMBER'));

COMMENT ON COLUMN users.role IS
    'User role: PLATFORM_ADMIN, TENANT_ADMIN, SITE_MANAGER, or MEMBER.';

CREATE TABLE user_site (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id    UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
);

CREATE INDEX idx_user_site_tenant_id ON user_site(tenant_id);
CREATE INDEX idx_user_site_site_id ON user_site(site_id);
CREATE INDEX idx_user_site_user_id ON user_site(user_id);

ALTER TABLE user_site ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_site FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_site
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_site TO app_rls, app_admin;
