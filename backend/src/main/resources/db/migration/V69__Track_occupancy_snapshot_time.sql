ALTER TABLE slot_occupancy
    ADD COLUMN snapshot_seen_at TIMESTAMPTZ;

UPDATE slot_occupancy
   SET snapshot_seen_at = last_seen_at
 WHERE snapshot_reference IS NOT NULL;
