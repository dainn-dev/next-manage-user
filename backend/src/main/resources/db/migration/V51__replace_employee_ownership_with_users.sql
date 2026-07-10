-- Replace military personnel ownership with application users.
-- Existing migrations are immutable; this migration preserves any existing
-- users.employee_id mappings before retiring the legacy domain tables.

ALTER TABLE vehicles ADD COLUMN owner_id UUID;
ALTER TABLE vehicle_log ADD COLUMN owner_id UUID;

UPDATE vehicles v
SET owner_id = u.id
FROM users u
WHERE u.employee_id = v.employee_id;

UPDATE vehicle_log vl
SET owner_id = u.id
FROM users u
WHERE u.employee_id = vl.employee_id;

-- security_guard_id is retained as a User relation. Translate known legacy
-- employee references and clear unmatched values before changing its FK.
UPDATE vehicle_log vl
SET security_guard_id = u.id
FROM users u
WHERE u.employee_id = vl.security_guard_id;

UPDATE vehicle_log vl
SET security_guard_id = NULL
WHERE security_guard_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = vl.security_guard_id);

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_employee_id_fkey;
ALTER TABLE vehicle_log DROP CONSTRAINT IF EXISTS vehicle_log_employee_id_fkey;
ALTER TABLE vehicle_log DROP CONSTRAINT IF EXISTS vehicle_log_security_guard_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_employee;

DROP INDEX IF EXISTS idx_vehicles_employee_id;
DROP INDEX IF EXISTS idx_vehicle_log_employee_id;
DROP INDEX IF EXISTS idx_users_employee_id;

ALTER TABLE vehicles DROP COLUMN employee_id;
ALTER TABLE vehicle_log DROP COLUMN employee_id;
ALTER TABLE users DROP COLUMN employee_id;

ALTER TABLE vehicles
    ADD CONSTRAINT fk_vehicles_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vehicle_log
    ADD CONSTRAINT fk_vehicle_log_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vehicle_log
    ADD CONSTRAINT fk_vehicle_log_security_guard_user
    FOREIGN KEY (security_guard_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_vehicles_owner_id ON vehicles(owner_id);
CREATE INDEX idx_vehicle_log_owner_id ON vehicle_log(owner_id);
CREATE INDEX idx_vehicle_log_security_guard_id ON vehicle_log(security_guard_id);

DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
