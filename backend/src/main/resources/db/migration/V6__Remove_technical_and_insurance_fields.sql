-- Remove technical and insurance fields from vehicles table
ALTER TABLE vehicles DROP COLUMN IF EXISTS engine_number;
ALTER TABLE vehicles DROP COLUMN IF EXISTS chassis_number;
ALTER TABLE vehicles DROP COLUMN IF EXISTS insurance_number;
ALTER TABLE vehicles DROP COLUMN IF EXISTS insurance_expiry;
