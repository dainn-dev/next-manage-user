-- DAI-303: durable backend projection for authoritative VehicleRelocated events.
-- Existing Flyway migrations are immutable; this adds the relocation event/outbox
-- records and extends the occupancy projection with the last trusted frame key.

ALTER TABLE slot_occupancy
    ADD COLUMN snapshot_reference VARCHAR(500);

CREATE UNIQUE INDEX uq_slot_occupancy_active_track
    ON slot_occupancy(site_id, track_id)
    WHERE status = 'occupied';

CREATE TABLE parking_event (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
                            REFERENCES tenant(id),
    site_id             UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    event_type          VARCHAR(40) NOT NULL CHECK (event_type IN ('VehicleRelocated')),
    identity_key        VARCHAR(255) NOT NULL,
    transition_sequence BIGINT NOT NULL CHECK (transition_sequence > 0),
    occurred_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    correlation_id      UUID NOT NULL,
    causation_id        UUID NOT NULL,
    payload             JSONB NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_parking_event_identity_sequence
        UNIQUE (tenant_id, site_id, identity_key, transition_sequence)
);

CREATE INDEX idx_parking_event_tenant_site_occurred
    ON parking_event(tenant_id, site_id, occurred_at DESC);

CREATE TABLE parking_event_snapshot (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
                            REFERENCES tenant(id),
    event_id            UUID NOT NULL REFERENCES parking_event(id) ON DELETE CASCADE,
    kind                VARCHAR(32) NOT NULL CHECK (kind IN ('relocation_old', 'relocation_new')),
    snapshot_reference  VARCHAR(500) NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_parking_event_snapshot_kind UNIQUE (event_id, kind)
);

CREATE TABLE outbox_message (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
                            REFERENCES tenant(id),
    event_id            UUID NOT NULL UNIQUE REFERENCES parking_event(id) ON DELETE CASCADE,
    routing_key         VARCHAR(200) NOT NULL,
    payload             JSONB NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'dispatched', 'failed')),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispatched_at       TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_outbox_message_pending
    ON outbox_message(status, created_at)
    WHERE status = 'pending';

ALTER TABLE parking_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_event FORCE ROW LEVEL SECURITY;
ALTER TABLE parking_event_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_event_snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_message FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON parking_event
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_isolation ON parking_event_snapshot
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_isolation ON outbox_message
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_event, parking_event_snapshot, outbox_message
    TO app_rls, app_admin;
