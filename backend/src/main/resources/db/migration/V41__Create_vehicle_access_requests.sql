-- V39b: bring vehicle_access_requests under Flyway management (R1).
--
-- It is the one table Hibernate's ddl-auto created rather than Flyway (V35 only
-- guarded/relaxed it via DO $$ IF EXISTS). On a fresh DB it does not exist at this
-- point, so we CREATE it here from a snapshot of what ddl-auto produces (entity
-- VehicleAccessRequest + the V35 additions), already carrying tenant_id/site_id.
-- On an existing DB the CREATE is skipped and we add the tenant columns to the
-- live table instead. The exact column types must be diffed against a real
-- `pg_dump -t vehicle_access_requests` before flipping ddl-auto -> validate (that
-- flip is deferred; ddl-auto stays 'update' for now).

CREATE TABLE IF NOT EXISTS vehicle_access_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id       UUID REFERENCES vehicles(id),
    requester_id     UUID REFERENCES users(id),
    license_plate    VARCHAR(255),
    gate_id          UUID REFERENCES gate(id) ON DELETE SET NULL,
    image_path       VARCHAR(512),
    source           VARCHAR(16)  NOT NULL DEFAULT 'USER',
    approver_id      UUID REFERENCES users(id),
    status           VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    request_reason   VARCHAR(255) NOT NULL,
    rejection_reason VARCHAR(255),
    valid_from       DATE,
    valid_to         DATE,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP,
    tenant_id        UUID,
    site_id          UUID
);

-- Existing DB path: add the tenant columns if the table predated them.
ALTER TABLE vehicle_access_requests ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE vehicle_access_requests ADD COLUMN IF NOT EXISTS site_id   UUID;

UPDATE vehicle_access_requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE vehicle_access_requests SET site_id   = '00000000-0000-0000-0000-000000000002' WHERE site_id   IS NULL;

ALTER TABLE vehicle_access_requests
    ALTER COLUMN tenant_id SET NOT NULL,
    ALTER COLUMN tenant_id SET DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    ALTER COLUMN site_id   SET NOT NULL,
    ALTER COLUMN site_id   SET DEFAULT '00000000-0000-0000-0000-000000000002';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_var_tenant') THEN
        ALTER TABLE vehicle_access_requests
            ADD CONSTRAINT fk_var_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_var_site') THEN
        ALTER TABLE vehicle_access_requests
            ADD CONSTRAINT fk_var_site FOREIGN KEY (site_id) REFERENCES site(id);
    END IF;
END $$;

-- Re-assert the V35 indexes (skipped on a fresh DB where V35 found no table) plus tenant_id.
CREATE INDEX IF NOT EXISTS idx_access_requests_gate_id
    ON vehicle_access_requests(gate_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status_source_created
    ON vehicle_access_requests(status, source, created_at);
CREATE INDEX IF NOT EXISTS idx_var_tenant_id
    ON vehicle_access_requests(tenant_id);
