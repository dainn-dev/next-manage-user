-- Create custom_fields table
CREATE TABLE custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'number', 'date', 'select', 'checkbox', 'textarea')),
    options TEXT,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    category VARCHAR(255) NOT NULL,
    field_order INTEGER NOT NULL,
    description TEXT,
    default_value TEXT,
    validation_rules TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_custom_fields_category ON custom_fields(category);
CREATE INDEX idx_custom_fields_type ON custom_fields(type);
CREATE INDEX idx_custom_fields_required ON custom_fields(required);
CREATE INDEX idx_custom_fields_is_active ON custom_fields(is_active);
CREATE INDEX idx_custom_fields_order ON custom_fields(field_order);
CREATE INDEX idx_custom_fields_name ON custom_fields(name);

-- Create unique constraint on name to prevent duplicates
CREATE UNIQUE INDEX idx_custom_fields_name_unique ON custom_fields(name);

-- Insert sample custom fields data
INSERT INTO custom_fields (name, type, options, required, category, field_order, description, is_active) VALUES
('Employee ID', 'text', NULL, TRUE, 'Basic Information', 1, 'Unique identifier for the employee', TRUE),
('Full Name', 'text', NULL, TRUE, 'Basic Information', 2, 'Complete name of the employee', TRUE),
('Email Address', 'text', NULL, TRUE, 'Contact Information', 3, 'Primary email address', TRUE),
('Phone Number', 'text', NULL, TRUE, 'Contact Information', 4, 'Primary phone number', TRUE),
('Department', 'select', '["HR", "IT", "Finance", "Marketing", "Operations", "Sales"]', TRUE, 'Work Information', 5, 'Department where employee works', TRUE),
('Position', 'text', NULL, TRUE, 'Work Information', 6, 'Job title or position', TRUE),
('Hire Date', 'date', NULL, TRUE, 'Work Information', 7, 'Date when employee was hired', TRUE),
('Birth Date', 'date', NULL, FALSE, 'Personal Information', 8, 'Employee birth date', TRUE),
('Gender', 'select', '["Male", "Female", "Other", "Prefer not to say"]', FALSE, 'Personal Information', 9, 'Employee gender', TRUE),
('Address', 'textarea', NULL, FALSE, 'Contact Information', 10, 'Home address', TRUE),
('Emergency Contact', 'text', NULL, FALSE, 'Emergency Information', 11, 'Emergency contact person', TRUE),
('Emergency Phone', 'text', NULL, FALSE, 'Emergency Information', 12, 'Emergency contact phone number', TRUE),
('Salary', 'number', NULL, FALSE, 'Financial Information', 13, 'Employee salary', FALSE),
('Access Level', 'select', '["General", "Restricted", "Admin"]', TRUE, 'Security Information', 14, 'System access level', TRUE),
('Has Vehicle', 'checkbox', NULL, FALSE, 'Vehicle Information', 15, 'Whether employee has a registered vehicle', TRUE),
('Vehicle Type', 'select', '["Car", "Motorbike", "Truck", "Bus"]', FALSE, 'Vehicle Information', 16, 'Type of vehicle owned', TRUE),
('License Plate', 'text', NULL, FALSE, 'Vehicle Information', 17, 'Vehicle license plate number', TRUE),
('Insurance Number', 'text', NULL, FALSE, 'Vehicle Information', 18, 'Vehicle insurance number', TRUE),
('Notes', 'textarea', NULL, FALSE, 'Additional Information', 19, 'Additional notes about the employee', TRUE),
('Is Active', 'checkbox', NULL, TRUE, 'Status Information', 20, 'Whether employee is currently active', TRUE);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custom_fields_updated_at
    BEFORE UPDATE ON custom_fields
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_fields_updated_at();
