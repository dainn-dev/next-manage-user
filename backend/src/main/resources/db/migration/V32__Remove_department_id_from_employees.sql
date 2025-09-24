-- Remove department_id column from employees table
-- This migration removes the department_id foreign key column since we're using department names directly

-- Step 1: Drop the foreign key constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS fk_employees_department;

-- Step 2: Drop the index on department_id
DROP INDEX IF EXISTS idx_employees_department_id;

-- Step 3: Remove the department_id column
ALTER TABLE employees DROP COLUMN IF EXISTS department_id;

-- Step 4: Update the trigger function to only work with department names
CREATE OR REPLACE FUNCTION update_department_employee_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for old department (if exists)
    IF TG_OP = 'UPDATE' AND OLD.department IS DISTINCT FROM NEW.department THEN
        -- Update count for old department by name
        IF OLD.department IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department = OLD.department
            )
            WHERE name = OLD.department;
        END IF;
    END IF;
    
    -- Update count for new department (INSERT or UPDATE)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update count for new department by name
        IF NEW.department IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department = NEW.department
            )
            WHERE name = NEW.department;
        END IF;
    END IF;
    
    -- Update count for deleted employee's department
    IF TG_OP = 'DELETE' THEN
        -- Update count for deleted employee's department by name
        IF OLD.department IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department = OLD.department
            )
            WHERE name = OLD.department;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add comment
COMMENT ON COLUMN employees.department IS 'Department name - used for direct lookup without foreign key relationship';
