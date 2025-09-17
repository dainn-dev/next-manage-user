-- Create vehicle_log table for tracking entry/exit activities
CREATE TABLE vehicle_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate_number VARCHAR(20) NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    entry_exit_time TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('entry', 'exit')),
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('internal', 'external')),
    driver_name VARCHAR(255),
    purpose TEXT,
    gate_location VARCHAR(100),
    security_guard_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT,
    image_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_vehicle_log_license_plate ON vehicle_log(license_plate_number);
CREATE INDEX idx_vehicle_log_entry_exit_time ON vehicle_log(entry_exit_time);
CREATE INDEX idx_vehicle_log_type ON vehicle_log(type);
CREATE INDEX idx_vehicle_log_vehicle_type ON vehicle_log(vehicle_type);
CREATE INDEX idx_vehicle_log_vehicle_id ON vehicle_log(vehicle_id);
CREATE INDEX idx_vehicle_log_employee_id ON vehicle_log(employee_id);
-- Note: Functional index using date_trunc removed due to PostgreSQL immutability requirements
-- This can be added later if needed with proper immutable function declaration

-- Create trigger for updated_at
CREATE TRIGGER update_vehicle_log_updated_at BEFORE UPDATE ON vehicle_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data
INSERT INTO vehicle_log (license_plate_number, type, vehicle_type, entry_exit_time, driver_name, purpose, gate_location) VALUES
('29B-42023', 'entry', 'internal', CURRENT_TIMESTAMP - INTERVAL '2 hours', 'Nguyễn Văn A', 'Công tác', 'Cổng chính'),
('30A-12345', 'exit', 'internal', CURRENT_TIMESTAMP - INTERVAL '1 hour', 'Trần Thị B', 'Về nhà', 'Cổng phụ'),
('51G-67890', 'entry', 'external', CURRENT_TIMESTAMP - INTERVAL '30 minutes', 'Lê Văn C', 'Giao hàng', 'Cổng chính'),
('29B-42023', 'exit', 'internal', CURRENT_TIMESTAMP - INTERVAL '15 minutes', 'Nguyễn Văn A', 'Hoàn thành công tác', 'Cổng chính');
