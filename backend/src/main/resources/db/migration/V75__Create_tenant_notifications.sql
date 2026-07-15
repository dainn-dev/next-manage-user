CREATE TABLE notification_preference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID REFERENCES site(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'PUSH')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_start TIME,
    quiet_end TIME,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notification_preference_quiet_pair CHECK ((quiet_start IS NULL) = (quiet_end IS NULL))
);
CREATE UNIQUE INDEX uq_notification_preference_scope ON notification_preference
    (tenant_id, user_id, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type, channel);

CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id) ON DELETE CASCADE,
    site_id UUID REFERENCES site(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_event_id UUID NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'PUSH')),
    template_key VARCHAR(100) NOT NULL,
    locale VARCHAR(16) NOT NULL DEFAULT 'en',
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','DELIVERED','FAILED','DEAD_LETTER','SUPPRESSED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error VARCHAR(500),
    read_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_event_id, user_id, channel)
);
CREATE INDEX idx_notification_inbox ON notification(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_notification_delivery_queue ON notification(tenant_id, status, next_attempt_at);

CREATE TABLE notification_delivery_attempt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notification(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    error VARCHAR(500),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (notification_id, attempt_number)
);

ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preference FORCE ROW LEVEL SECURITY;
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_attempt FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notification_preference USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_isolation ON notification USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_isolation ON notification_delivery_attempt USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preference, notification, notification_delivery_attempt TO app_rls, app_admin;
