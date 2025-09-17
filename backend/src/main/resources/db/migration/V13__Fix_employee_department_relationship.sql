-- Fix employee-department relationship by adding proper foreign key
-- Step 1: Add department_id column to employees table
ALTER TABLE employees ADD COLUMN department_id UUID;

-- Step 2: Create foreign key constraint
ALTER TABLE employees ADD CONSTRAINT fk_employees_department 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Step 3: Create index for better performance
CREATE INDEX idx_employees_department_id ON employees(department_id);

-- Step 4: Migrate existing data - map department names to department IDs
UPDATE employees 
SET department_id = d.id 
FROM departments d 
WHERE employees.department = d.name;

-- Step 5: Handle any unmapped departments by setting them to NULL
-- (This is safe as we already have the old department name in the department column)

-- Step 6: Update the trigger function to work with both department_id and department name
CREATE OR REPLACE FUNCTION update_department_employee_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for old department (if exists)
    IF TG_OP = 'UPDATE' AND OLD.department_id IS DISTINCT FROM NEW.department_id THEN
        -- Update count for old department by ID
        IF OLD.department_id IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department_id = OLD.department_id
            )
            WHERE id = OLD.department_id;
        END IF;
        
        -- Also update by name for backward compatibility
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
        -- Update count for new department by ID
        IF NEW.department_id IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department_id = NEW.department_id
            )
            WHERE id = NEW.department_id;
        END IF;
        
        -- Also update by name for backward compatibility
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
        -- Update count for deleted employee's department by ID
        IF OLD.department_id IS NOT NULL THEN
            UPDATE departments 
            SET employee_count = (
                SELECT COUNT(*) 
                FROM employees 
                WHERE department_id = OLD.department_id
            )
            WHERE id = OLD.department_id;
        END IF;
        
        -- Also update by name for backward compatibility
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

-- Step 7: Add comment for the new column
COMMENT ON COLUMN employees.department_id IS 'Foreign key reference to departments table';
