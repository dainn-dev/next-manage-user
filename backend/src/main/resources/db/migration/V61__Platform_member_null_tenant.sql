-- Phase C (ADR-0603): platform MEMBER has users.tenant_id NULL;
-- tenant ops see them via member_affiliation; seat count includes affiliations.

-- Backfill any MEMBER still missing an affiliation for their legacy home tenant.
INSERT INTO member_affiliation (user_id, tenant_id, status, created_at, updated_at)
SELECT u.id, u.tenant_id, 'ACTIVE', COALESCE(u.created_at, NOW()), NOW()
FROM users u
WHERE u.role = 'MEMBER'
  AND u.tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

UPDATE users
SET tenant_id = NULL
WHERE role = 'MEMBER'
  AND tenant_id IS NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_role_check;
ALTER TABLE users ADD CONSTRAINT users_tenant_role_check CHECK (
    (role = 'PLATFORM_ADMIN' AND tenant_id IS NULL)
    OR (role = 'MEMBER' AND tenant_id IS NULL)
    OR (role IN ('TENANT_ADMIN', 'SITE_MANAGER') AND tenant_id IS NOT NULL)
);

COMMENT ON CONSTRAINT users_tenant_role_check ON users IS
    'PLATFORM_ADMIN and MEMBER are platform-scoped (tenant_id NULL); ops roles require a home tenant.';

-- TA/SM can read platform MEMBERs affiliated to the current tenant.
ALTER POLICY users_tenant_isolation ON users
    USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR current_user = 'app_auth'
        OR (
            role = 'MEMBER'
            AND tenant_id IS NULL
            AND EXISTS (
                SELECT 1
                FROM member_affiliation ma
                WHERE ma.user_id = users.id
                  AND ma.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                  AND ma.status IN ('ACTIVE', 'INVITED')
            )
        )
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR (
            role = 'MEMBER'
            AND tenant_id IS NULL
            AND (
                current_user = 'app_admin'
                OR EXISTS (
                    SELECT 1
                    FROM member_affiliation ma
                    WHERE ma.user_id = users.id
                      AND ma.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                )
            )
        )
    );
