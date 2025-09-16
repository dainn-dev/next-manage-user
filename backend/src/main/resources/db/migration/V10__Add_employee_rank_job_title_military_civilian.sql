-- Add new columns to employees table for rank, job title, and military/civilian status
ALTER TABLE employees 
ADD COLUMN rank VARCHAR(100), -- Cấp bậc
ADD COLUMN job_title VARCHAR(100), -- Chức vụ  
ADD COLUMN military_civilian VARCHAR(20); -- SQ/QNCN

-- Add comments for clarity
COMMENT ON COLUMN employees.rank IS 'Cấp bậc - Employee rank/grade';
COMMENT ON COLUMN employees.job_title IS 'Chức vụ - Job title/position';
COMMENT ON COLUMN employees.military_civilian IS 'SQ/QNCN - Military/Civilian status';
