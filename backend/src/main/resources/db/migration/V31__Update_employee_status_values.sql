-- Update employee status constraint to new Vietnamese values
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;

-- Update existing data to new status values
UPDATE employees SET status = 'HOAT_DONG' WHERE status = 'active';
UPDATE employees SET status = 'TRANH_THU' WHERE status = 'inactive';
UPDATE employees SET status = 'LY_DO_KHAC' WHERE status = 'terminated';

-- Add new constraint with Vietnamese status values
ALTER TABLE employees ADD CONSTRAINT employees_status_check 
CHECK (status IN ('HOAT_DONG', 'TRANH_THU', 'PHEP', 'LY_DO_KHAC'));
