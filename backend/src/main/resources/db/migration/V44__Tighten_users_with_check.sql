-- V44 (S1): tighten the users policy so the app_auth exception is READ-ONLY.
--
-- V43 gave app_auth an exception in BOTH arms of users_tenant_isolation
-- (USING + WITH CHECK). app_auth is the pre-tenant identity-lookup role
-- (loadUserByUsername), which only ever needs to READ any user row. Leaving the
-- exception in WITH CHECK would let that role INSERT/UPDATE a user into ANY
-- tenant — a write-any-tenant capability it must never have. Drop it from
-- WITH CHECK (writes stay strictly tenant-scoped) and keep it in USING (reads
-- across tenants for the identity lookup remain allowed).
--
-- Lands BEFORE the app_auth-backed loadUserByUsername wiring so the read-only
-- identity role can never gain write-any-tenant, even transiently.
ALTER POLICY users_tenant_isolation ON users
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR current_user = 'app_auth')
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
