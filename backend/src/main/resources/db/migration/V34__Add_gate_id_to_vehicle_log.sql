-- Add nullable gate_id to vehicle_log referencing the gate registry.
-- Schema-only: the log write flow does not populate gate_id yet (Phase 3.2).
ALTER TABLE vehicle_log
    ADD COLUMN gate_id UUID REFERENCES gate(id) ON DELETE SET NULL;

CREATE INDEX idx_vehicle_log_gate_id ON vehicle_log(gate_id);
