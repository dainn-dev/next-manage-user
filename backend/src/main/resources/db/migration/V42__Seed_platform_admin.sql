-- V42 (G2): seed the first PLATFORM_ADMIN (cross-tenant, tenant_id NULL) as a
-- versioned migration rather than the runtime seeder, and BEFORE RLS is enabled
-- (V43) so the owner INSERT is not itself blocked by FORCE RLS on users.
--
-- Fail-closed: the admin is created ONLY when both an email and a bcrypt password
-- hash are supplied via the env-backed Flyway placeholders
-- (spring.flyway.placeholders.platform_admin_*). In prod with those unset the
-- placeholders resolve to '' and NOTHING is inserted — never a default or
-- blank-credential platform admin. Idempotent: skips if one already exists.
INSERT INTO users (id, username, email, password, first_name, last_name,
                   role, status, tenant_id, created_at, updated_at)
SELECT gen_random_uuid(), 'platform_admin',
       '${platform_admin_email}', '${platform_admin_password_hash}',
       'Platform', 'Admin', 'PLATFORM_ADMIN', 'ACTIVE', NULL, now(), now()
WHERE '${platform_admin_email}' <> ''
  AND '${platform_admin_password_hash}' <> ''
  AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'PLATFORM_ADMIN');
