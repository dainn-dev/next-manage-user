-- Fix the department employee count trigger to handle the new schema properly
-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_update_department_employee_count ON employees;

-- Create a new, safer trigger function that only uses the new department_id field
CREATE OR REPLACE FUNCTION update_department_employee_count_new()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for old department (if exists) - UPDATE and DELETE operations
    IF TG_OP = 'UPDATE' AND OLD.department_id IS DISTINCT FROM NEW.department_id THEN
        IF OLD.department_id IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department_id = OLD.department_id
            )
            WHERE id = OLD.department_id;
        END IF;
    END IF;
    
    -- Update count for new department (INSERT or UPDATE)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.department_id IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department_id = NEW.department_id
            )
            WHERE id = NEW.department_id;
        END IF;
    END IF;
    
    -- Update count for deleted employee's department
    IF TG_OP = 'DELETE' THEN
        IF OLD.department_id IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department_id = OLD.department_id
            )
            WHERE id = OLD.department_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger
CREATE TRIGGER trigger_update_department_employee_count_new
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_department_employee_count_new();

-- Update all department employee counts to be accurate
UPDATE departments 
SET employee_count = (
    SELECT COUNT(*) 
    FROM employees 
    WHERE department_id = departments.id
);

-- Add comment
COMMENT ON FUNCTION update_department_employee_count_new() IS 'Trigger function to update department employee counts using department_id foreign key';
