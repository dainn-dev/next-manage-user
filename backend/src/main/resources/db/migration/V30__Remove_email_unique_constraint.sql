-- Remove unique constraint from email column in employees table
ALTER TABLE employees DROP CONSTRAINT IF EXISTS uk_employees_email;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key;

-- For PostgreSQL, we may need to recreate the column without unique constraint
-- First, let's make the column nullable and remove unique constraint
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
