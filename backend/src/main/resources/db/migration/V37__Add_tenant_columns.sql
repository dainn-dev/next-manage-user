-- V37 (expand + backfill in one step): add tenant_id/site_id to every existing
-- tenant-scoped table with a CONSTANT DEFAULT of the DEFAULT tenant/site seeded
-- in V36.
--
-- Adding a column with a constant default backfills existing rows as a
-- metadata-only change (PG 11+) and — crucially — does NOT fire row triggers. An
-- UPDATE-based backfill would trip the stale `trigger_update_department_employee_count_new`
-- on `employees` (it references OLD.department_id, a column dropped in V32 whose
-- trigger V32 never repaired — a pre-existing latent bug, flagged separately).
--
-- V39 switches the tenant_id default to the session-derived value
-- (current_setting('app.tenant_id')) for future inserts and enforces NOT NULL/FK.

ALTER TABLE employees   ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE vehicles    ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE users       ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE departments ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE positions   ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE gate        ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE vehicle_log ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE gate        ADD COLUMN IF NOT EXISTS site_id UUID DEFAULT '00000000-0000-0000-0000-000000000002';
ALTER TABLE vehicle_log ADD COLUMN IF NOT EXISTS site_id UUID DEFAULT '00000000-0000-0000-0000-000000000002';
