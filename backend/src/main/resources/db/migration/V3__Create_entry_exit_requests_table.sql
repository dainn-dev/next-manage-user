-- Create entry_exit_requests table
CREATE TABLE entry_exit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    request_type VARCHAR(10) NOT NULL CHECK (request_type IN ('entry', 'exit')),
    request_time TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_entry_exit_requests_employee_id ON entry_exit_requests(employee_id);
CREATE INDEX idx_entry_exit_requests_vehicle_id ON entry_exit_requests(vehicle_id);
CREATE INDEX idx_entry_exit_requests_request_type ON entry_exit_requests(request_type);
CREATE INDEX idx_entry_exit_requests_status ON entry_exit_requests(status);
CREATE INDEX idx_entry_exit_requests_request_time ON entry_exit_requests(request_time);
