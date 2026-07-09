-- V39 (contract): now that every row is backfilled (V38), enforce NOT NULL, add
-- the FK to tenant(id), and index tenant_id for the RLS predicate.
--
-- The column DEFAULT is NULLIF(current_setting('app.tenant_id', true), '')::uuid: an INSERT
-- that does not name tenant_id gets the *current session's* tenant automatically
-- (set per-transaction by TenantRoutingJpaTransactionManager). This is what lets
-- the 7 existing entities stay unmapped for tenant_id yet still satisfy the RLS
-- WITH CHECK, and it fails closed for writes in Deploy 2 (unset session var ->
-- NULL -> NOT NULL violation) instead of silently writing the wrong tenant.

-- Helper: apply the standard tenant_id contract to a NOT NULL table.
ALTER TABLE employees   ALTER COLUMN tenant_id SET NOT NULL,
                        ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
ALTER TABLE vehicles    ALTER COLUMN tenant_id SET NOT NULL,
                        ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
ALTER TABLE departments ALTER COLUMN tenant_id SET NOT NULL,
                        ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
ALTER TABLE positions   ALTER COLUMN tenant_id SET NOT NULL,
                        ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
ALTER TABLE gate        ALTER COLUMN tenant_id SET NOT NULL,
                        ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
ALTER TABLE vehicle_log ALTER COLUMN tenant_id SET NOT NULL,
                        ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;

-- users.tenant_id stays NULLABLE: a PLATFORM_ADMIN has no tenant (tenant_id NULL).
-- It still gets the session-derived default so normal tenant users are stamped.
ALTER TABLE users       ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid;

-- site_id contract for the site-scoped tables (defaults to the seeded DEFAULT_SITE
-- for now; per-site assignment is a later stage).
ALTER TABLE gate        ALTER COLUMN site_id SET NOT NULL,
                        ALTER COLUMN site_id SET DEFAULT '00000000-0000-0000-0000-000000000002';
ALTER TABLE vehicle_log ALTER COLUMN site_id SET NOT NULL,
                        ALTER COLUMN site_id SET DEFAULT '00000000-0000-0000-0000-000000000002';

-- Foreign keys to the tenancy root.
ALTER TABLE employees   ADD CONSTRAINT fk_employees_tenant   FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE vehicles    ADD CONSTRAINT fk_vehicles_tenant    FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE users       ADD CONSTRAINT fk_users_tenant       FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE departments ADD CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE positions   ADD CONSTRAINT fk_positions_tenant   FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE gate        ADD CONSTRAINT fk_gate_tenant        FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE vehicle_log ADD CONSTRAINT fk_vehicle_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id);
ALTER TABLE gate        ADD CONSTRAINT fk_gate_site          FOREIGN KEY (site_id)   REFERENCES site(id);
ALTER TABLE vehicle_log ADD CONSTRAINT fk_vehicle_log_site   FOREIGN KEY (site_id)   REFERENCES site(id);

-- Indexes for the RLS predicate (tenant_id = current_setting(...)).
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id   ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id    ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id       ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_tenant_id ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_positions_tenant_id   ON positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gate_tenant_id        ON gate(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_log_tenant_id ON vehicle_log(tenant_id);
