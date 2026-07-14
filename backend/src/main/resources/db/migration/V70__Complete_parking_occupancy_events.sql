-- Complete the authoritative parking occupancy event projection for DAI-265.
ALTER TABLE parking_event DROP CONSTRAINT IF EXISTS parking_event_event_type_check;
ALTER TABLE parking_event ADD CONSTRAINT parking_event_event_type_check
    CHECK (event_type IN ('VehicleEntered', 'VehicleExited', 'VehicleRelocated'));

ALTER TABLE parking_event_snapshot DROP CONSTRAINT IF EXISTS parking_event_snapshot_kind_check;
ALTER TABLE parking_event_snapshot ADD CONSTRAINT parking_event_snapshot_kind_check
    CHECK (kind IN ('entry', 'exit', 'relocation_old', 'relocation_new'));

CREATE INDEX idx_slot_occupancy_expiry
    ON slot_occupancy(status, last_seen_at)
    WHERE status = 'occupied';
