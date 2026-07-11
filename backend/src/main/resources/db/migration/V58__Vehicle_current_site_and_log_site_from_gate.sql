-- Phase 2: last-known / current branch for vehicles (SITE_MANAGER scoping).

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS current_site_id UUID NULL REFERENCES site(id);

CREATE INDEX IF NOT EXISTS idx_vehicles_current_site_id ON vehicles(current_site_id);

COMMENT ON COLUMN vehicles.current_site_id IS
    'Last-known / current site (branch). Updated on gate entry; kept on exit. NULL = unassigned (TENANT_ADMIN only until stamped).';
