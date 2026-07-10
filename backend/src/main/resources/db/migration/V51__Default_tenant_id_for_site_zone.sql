-- V49 (DAI-281): make tenant-scoped Site/Zone CRUD compatible with Deploy-2 RLS.
--
-- Site and zone were introduced in V36 before the session-derived tenant default
-- contract was standardized in V39. Their tenant_id columns are intentionally not
-- mapped in the JPA entities; the transaction manager sets app.tenant_id and these
-- defaults stamp the current tenant on inserts. Without them, inserts omit
-- tenant_id and fail the RLS WITH CHECK policy.

ALTER TABLE site
    ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;

ALTER TABLE zone
    ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
