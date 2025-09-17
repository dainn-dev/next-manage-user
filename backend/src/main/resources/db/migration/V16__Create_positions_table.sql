-- Create positions table for position management (Chức vụ)
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    parent_id UUID,
    level VARCHAR(50) NOT NULL DEFAULT 'JUNIOR',
    min_salary DECIMAL(12,2),
    max_salary DECIMAL(12,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_positions_name ON positions(name);
CREATE INDEX idx_positions_parent_id ON positions(parent_id);
CREATE INDEX idx_positions_level ON positions(level);
CREATE INDEX idx_positions_is_active ON positions(is_active);
CREATE INDEX idx_positions_display_order ON positions(display_order);

-- Add unique constraint
ALTER TABLE positions ADD CONSTRAINT uk_positions_name UNIQUE (name);

-- Insert sample data
INSERT INTO positions (id, name, description, parent_id, level, min_salary, max_salary, is_active, display_order) VALUES
('10000000-0000-0000-0000-000000000001', 'Giám đốc điều hành', 'Giám đốc điều hành công ty', NULL, 'EXECUTIVE', 50000000, 100000000, true, 1),
('10000000-0000-0000-0000-000000000002', 'Phó giám đốc', 'Phó giám đốc công ty', '10000000-0000-0000-0000-000000000001', 'DIRECTOR', 30000000, 50000000, true, 2),
('10000000-0000-0000-0000-000000000003', 'Trưởng phòng Nhân sự', 'Trưởng phòng quản lý nhân sự', '10000000-0000-0000-0000-000000000002', 'MANAGER', 20000000, 30000000, true, 3),
('10000000-0000-0000-0000-000000000004', 'Trưởng phòng Kỹ thuật', 'Trưởng phòng kỹ thuật và công nghệ', '10000000-0000-0000-0000-000000000002', 'MANAGER', 20000000, 30000000, true, 4),
('10000000-0000-0000-0000-000000000005', 'Chuyên viên Nhân sự', 'Chuyên viên quản lý nhân sự', '10000000-0000-0000-0000-000000000003', 'SENIOR', 12000000, 20000000, true, 5),
('10000000-0000-0000-0000-000000000006', 'Kỹ sư phần mềm Senior', 'Kỹ sư phần mềm cao cấp', '10000000-0000-0000-0000-000000000004', 'SENIOR', 15000000, 25000000, true, 6),
('10000000-0000-0000-0000-000000000007', 'Kỹ sư phần mềm', 'Kỹ sư phần mềm', '10000000-0000-0000-0000-000000000004', 'JUNIOR', 8000000, 15000000, true, 7),
('10000000-0000-0000-0000-000000000008', 'Thực tập sinh IT', 'Thực tập sinh công nghệ thông tin', '10000000-0000-0000-0000-000000000004', 'INTERN', 3000000, 5000000, true, 8);

-- Add foreign key constraint after data is inserted
ALTER TABLE positions ADD CONSTRAINT fk_positions_parent 
    FOREIGN KEY (parent_id) REFERENCES positions(id) ON DELETE SET NULL;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_positions_updated_at();