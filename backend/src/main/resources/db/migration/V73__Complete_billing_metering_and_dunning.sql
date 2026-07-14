-- DAI-262: metered usage idempotency and billing-owned tenant suspension.
ALTER TABLE tenant
    ADD COLUMN billing_suspended_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE processed_usage_event (
    message_id   UUID PRIMARY KEY,
    tenant_id    UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    metric       VARCHAR(80) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_processed_usage_event_tenant ON processed_usage_event(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON processed_usage_event TO app_rls, app_admin;

UPDATE billing_plan SET limits = limits || '{"camera_events_month":1000}'::jsonb WHERE code='free';
UPDATE billing_plan SET limits = limits || '{"camera_events_month":25000}'::jsonb WHERE code='starter';
UPDATE billing_plan SET limits = limits || '{"camera_events_month":250000}'::jsonb WHERE code='pro';
UPDATE billing_plan SET limits = limits || '{"camera_events_month":null}'::jsonb WHERE code='enterprise';
