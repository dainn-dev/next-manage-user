-- DAI-263: allow the transactional outbox to carry edge camera events as well
-- as authoritative parking events.
ALTER TABLE outbox_message
    ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE outbox_message
    DROP CONSTRAINT outbox_message_event_id_fkey;

ALTER TABLE outbox_message
    DROP CONSTRAINT outbox_message_event_id_key;

ALTER TABLE outbox_message
    ADD COLUMN aggregate_type VARCHAR(40) NOT NULL DEFAULT 'parking_event',
    ADD COLUMN source_event_id VARCHAR(100),
    ADD COLUMN camera_id UUID REFERENCES camera(id) ON DELETE CASCADE,
    ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_error VARCHAR(1000);

ALTER TABLE outbox_message
    ADD CONSTRAINT outbox_message_source_check CHECK (
        (aggregate_type = 'parking_event' AND event_id IS NOT NULL)
        OR
        (aggregate_type = 'camera_ingest' AND event_id IS NULL
            AND camera_id IS NOT NULL AND source_event_id IS NOT NULL)
    );

CREATE UNIQUE INDEX uq_outbox_parking_event
    ON outbox_message(event_id)
    WHERE aggregate_type = 'parking_event';

CREATE UNIQUE INDEX uq_outbox_camera_ingest
    ON outbox_message(camera_id, source_event_id)
    WHERE aggregate_type = 'camera_ingest';
