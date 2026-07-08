-- Create gate table: registry of physical gates with heartbeat tracking
CREATE TABLE gate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(255),
    camera_rtsp_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'disabled')),
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_gate_name ON gate(name);
CREATE INDEX idx_gate_status ON gate(status);

-- Create trigger for updated_at
CREATE TRIGGER update_gate_updated_at BEFORE UPDATE ON gate
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
