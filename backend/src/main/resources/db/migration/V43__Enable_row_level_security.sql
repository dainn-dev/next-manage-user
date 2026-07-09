-- V43 (Deploy 2): the enforcement step. Creates the three DB roles, grants, and
-- the tenant_isolation policies, then ENABLE + FORCE Row-Level Security on every
-- tenant-owned table. From here a transaction that has not set app.tenant_id (and
-- is not the app_auth users-exception) sees zero rows — fail-closed.
--
-- Operational note (two-deploy): run V36..V42 first, verify P3, then run V43.
-- Stage it with flyway.target=42 for the first deploy if needed.

-- ---- Roles -----------------------------------------------------------------
-- NOLOGIN roles the application's login role SET LOCAL ROLE's into per transaction
-- (TenantRoutingJpaTransactionManager). A superuser/owner may SET ROLE to any of
-- them; in prod: GRANT app_rls, app_auth, app_admin TO <app_login_role>.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rls')   THEN CREATE ROLE app_rls   NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_auth')  THEN CREATE ROLE app_auth  NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN CREATE ROLE app_admin NOLOGIN BYPASSRLS; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_rls, app_auth, app_admin;

-- app_rls: normal tenant-scoped request traffic (RLS confines the rows).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
-- app_admin: platform-admin path; BYPASSRLS above lets it cross tenants (audited).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_admin;
-- G1: app_auth is ONLY the pre-tenant identity lookup (users-policy exception),
-- so its table grants are scoped to users alone — least privilege on grants,
-- independent of the RLS exception.
GRANT SELECT ON users TO app_auth;

-- ---- Policies + FORCE RLS --------------------------------------------------
-- tenant root: keyed on id (it has no tenant_id column — it *is* the tenant).
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenant
    USING      (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Standard tenant_id-keyed tables.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'site', 'zone', 'employees', 'vehicles', 'departments',
        'positions', 'gate', 'vehicle_log', 'vehicle_access_requests'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation ON %I
                USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
                WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
        $f$, t);
    END LOOP;
END $$;

-- users: same isolation, plus the app_auth exception so the pre-tenant identity
-- lookup (loadUserByUsername, which runs before tenant context exists) can read
-- any user row. app_auth is NOBYPASSRLS and grant-scoped to users only, so this
-- exception cannot reach any other table. A PLATFORM_ADMIN's own null-tenant row
-- is reached via the app_admin (BYPASSRLS) path, never this exception.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE  ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_user = 'app_auth')
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_user = 'app_auth');
