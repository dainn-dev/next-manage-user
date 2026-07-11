-- Phase A (ADR-0603): MEMBER multi-org affiliation.
-- Backfill from existing MEMBER.users.tenant_id; do not null users.tenant_id yet (Phase C).

CREATE TABLE member_affiliation (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tenant_id),
    CONSTRAINT member_affiliation_status_check
        CHECK (status IN ('ACTIVE', 'INVITED', 'REVOKED'))
);

CREATE INDEX idx_member_affiliation_tenant_id ON member_affiliation(tenant_id);
CREATE INDEX idx_member_affiliation_user_id ON member_affiliation(user_id);
CREATE INDEX idx_member_affiliation_status ON member_affiliation(status);

COMMENT ON TABLE member_affiliation IS
    'Links a platform MEMBER to a tenant that may manage them (school/dorm). N affiliations per user.';

ALTER TABLE member_affiliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_affiliation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON member_affiliation
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON member_affiliation TO app_rls, app_admin;

-- Backfill: each existing MEMBER with a tenant becomes affiliated to that tenant.
INSERT INTO member_affiliation (user_id, tenant_id, status, created_at, updated_at)
SELECT u.id, u.tenant_id, 'ACTIVE', COALESCE(u.created_at, NOW()), NOW()
FROM users u
WHERE u.role = 'MEMBER'
  AND u.tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;
