-- Stage 5 dashboard: restore the site-scoped, read-only SECURITY_GUARD role.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER', 'SECURITY_GUARD', 'MEMBER'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_role_check;
ALTER TABLE users ADD CONSTRAINT users_tenant_role_check CHECK (
    (role IN ('PLATFORM_ADMIN', 'MEMBER') AND tenant_id IS NULL)
    OR (role IN ('TENANT_ADMIN', 'SITE_MANAGER', 'SECURITY_GUARD') AND tenant_id IS NOT NULL)
);

COMMENT ON COLUMN users.role IS
    'User role: PLATFORM_ADMIN, TENANT_ADMIN, SITE_MANAGER, SECURITY_GUARD, or MEMBER.';

COMMENT ON CONSTRAINT users_tenant_role_check ON users IS
    'Platform roles have no home tenant; tenant operators including SECURITY_GUARD require one.';
