ALTER TABLE gate ADD COLUMN IF NOT EXISTS gate_type VARCHAR(20)
    CHECK (gate_type IN ('ENTRANCE', 'EXIT'));

CREATE INDEX IF NOT EXISTS idx_gate_gate_type ON gate(gate_type);
