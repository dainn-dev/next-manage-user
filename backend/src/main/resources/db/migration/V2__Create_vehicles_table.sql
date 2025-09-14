-- Create vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('car', 'motorbike', 'truck', 'bus')),
    brand VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    year INTEGER,
    engine_number VARCHAR(100),
    chassis_number VARCHAR(100),
    registration_date DATE NOT NULL,
    expiry_date DATE,
    insurance_number VARCHAR(100),
    insurance_expiry DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
    fuel_type VARCHAR(20) CHECK (fuel_type IN ('gasoline', 'diesel', 'electric', 'hybrid')),
    capacity INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_vehicles_employee_id ON vehicles(employee_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_vehicle_type ON vehicles(vehicle_type);
CREATE INDEX idx_vehicles_status ON vehicles(status);

-- Create trigger for updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
