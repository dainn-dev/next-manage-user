-- Link cameras to gates: one gate may have multiple cameras (multi-lane).
ALTER TABLE camera ADD COLUMN IF NOT EXISTS gate_id UUID;
ALTER TABLE camera ADD CONSTRAINT fk_camera_gate
    FOREIGN KEY (gate_id) REFERENCES gate(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_camera_gate_id ON camera(gate_id);
