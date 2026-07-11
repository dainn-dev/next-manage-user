-- Platform-wide audit trail for SaaS operator actions (not tenant-scoped).
-- Written via app_admin (@PlatformAdminOperation); no tenant RLS.

CREATE TABLE platform_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID,
    actor_username  VARCHAR(100),
    action          VARCHAR(80) NOT NULL,
    resource_type   VARCHAR(80) NOT NULL,
    resource_id     UUID,
    detail          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_audit_log_created_at ON platform_audit_log(created_at DESC);
CREATE INDEX idx_platform_audit_log_action ON platform_audit_log(action);
CREATE INDEX idx_platform_audit_log_resource ON platform_audit_log(resource_type, resource_id);

GRANT SELECT, INSERT ON platform_audit_log TO app_admin;
GRANT SELECT ON platform_audit_log TO app_rls;
