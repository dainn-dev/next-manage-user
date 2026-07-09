-- Phase 4.4: allow VehicleAccessRequest to capture gate-originated requests for
-- unregistered plates (audit trail instead of allowing directly at the gate).
--
-- A gate-detected request has no Vehicle record and no human requester yet, so the
-- previously NOT NULL foreign keys must become optional. New columns carry the raw
-- plate, origin gate, evidence snapshot, and how the request originated.
--
-- The vehicle_access_requests table is Hibernate-managed (there is no CREATE
-- migration for it), and Flyway runs before Hibernate's ddl-auto. On a fresh
-- database the table does not exist yet at this point, so the whole migration is
-- guarded on its existence: on a fresh DB it is a no-op and Hibernate creates the
-- table from the (already relaxed) entity mapping; on an existing DB it relaxes the
-- NOT NULL constraints Hibernate's "update" mode will never drop and adds the new
-- columns/indexes up front (notably `source` with a default, so Hibernate does not
-- fail adding a NOT NULL column to a table that already has rows).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'vehicle_access_requests'
    ) THEN
        ALTER TABLE vehicle_access_requests ALTER COLUMN vehicle_id DROP NOT NULL;
        ALTER TABLE vehicle_access_requests ALTER COLUMN requester_id DROP NOT NULL;

        ALTER TABLE vehicle_access_requests
            ADD COLUMN IF NOT EXISTS license_plate VARCHAR(255);
        ALTER TABLE vehicle_access_requests
            ADD COLUMN IF NOT EXISTS gate_id UUID REFERENCES gate(id) ON DELETE SET NULL;
        ALTER TABLE vehicle_access_requests
            ADD COLUMN IF NOT EXISTS image_path VARCHAR(512);
        ALTER TABLE vehicle_access_requests
            ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'USER';

        CREATE INDEX IF NOT EXISTS idx_access_requests_gate_id
            ON vehicle_access_requests(gate_id);
        -- Speeds up the short-window duplicate check for gate detections.
        CREATE INDEX IF NOT EXISTS idx_access_requests_status_source_created
            ON vehicle_access_requests(status, source, created_at);
    END IF;
END $$;
