-- Create departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    parent_id UUID,
    manager_id UUID,
    employee_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_departments_parent 
        FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_departments_manager 
        FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_departments_parent_id ON departments(parent_id);
CREATE INDEX idx_departments_manager_id ON departments(manager_id);
CREATE INDEX idx_departments_employee_count ON departments(employee_count);
CREATE INDEX idx_departments_created_at ON departments(created_at);

-- Add comments for documentation
COMMENT ON TABLE departments IS 'Organizational departments and units';
COMMENT ON COLUMN departments.id IS 'Unique department identifier';
COMMENT ON COLUMN departments.name IS 'Department name (must be unique)';
COMMENT ON COLUMN departments.description IS 'Department description';
COMMENT ON COLUMN departments.parent_id IS 'Parent department ID for hierarchy';
COMMENT ON COLUMN departments.manager_id IS 'Department manager employee ID';
COMMENT ON COLUMN departments.employee_count IS 'Number of employees in department';
COMMENT ON COLUMN departments.created_at IS 'Department creation timestamp';
COMMENT ON COLUMN departments.updated_at IS 'Last update timestamp';

-- Insert sample departments data
INSERT INTO departments (id, name, description, parent_id, manager_id, employee_count) VALUES
('11111111-1111-1111-1111-111111111111', 'Department Name', 'Main department', NULL, NULL, 26),
('22222222-2222-2222-2222-222222222222', 'Tiểu Đoàn 9', 'Battalion 9', NULL, NULL, 28),
('99999999-9999-9999-9999-999999999999', 'Khách', 'Guest department', NULL, NULL, 0),
('33333333-3333-3333-3333-333333333333', 'Tiểu Đoàn 7', 'Battalion 7', NULL, NULL, 42),
('44444444-4444-4444-4444-444444444444', 'Khối Trực Thuộc', 'Direct reporting unit', NULL, NULL, 55),
('55555555-5555-5555-5555-555555555555', 'Tiểu Đoàn 8', 'Battalion 8', NULL, NULL, 31),
('66666666-6666-6666-6666-666666666666', 'Ban Tham Mưu', 'Staff department', NULL, NULL, 22),
('77777777-7777-7777-7777-777777777777', 'Ban Hậu Cần - Kỹ Thuật', 'Logistics and Technical department', NULL, NULL, 9),
('88888888-8888-8888-8888-888888888888', 'Cán Tin Khối Trực Thuộc', 'Direct unit canteen', '44444444-4444-4444-4444-444444444444', NULL, 5);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_departments_updated_at();

-- Create trigger to update employee count when employees are added/removed/updated
CREATE OR REPLACE FUNCTION update_department_employee_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for old department (if exists)
    IF TG_OP = 'UPDATE' AND OLD.department IS DISTINCT FROM NEW.department THEN
        UPDATE departments 
        SET employee_count = (
            SELECT COUNT(*) 
            FROM employees 
            WHERE department = OLD.department
        )
        WHERE name = OLD.department;
    END IF;
    
    -- Update count for new department (INSERT or UPDATE)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE departments 
        SET employee_count = (
            SELECT COUNT(*) 
            FROM employees 
            WHERE department = NEW.department
        )
        WHERE name = NEW.department;
    END IF;
    
    -- Update count for deleted employee's department
    IF TG_OP = 'DELETE' THEN
        UPDATE departments 
        SET employee_count = (
            SELECT COUNT(*) 
            FROM employees 
            WHERE department = OLD.department
        )
        WHERE name = OLD.department;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_department_employee_count
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_department_employee_count();
