-- DAI-275: Stripe-backed tenant subscription lifecycle foundation.
--
-- Plans are global catalog rows. Subscription and usage rows are tenant-owned
-- and use the same session-derived tenant_id + RLS contract as the rest of the
-- application. Stripe event IDs are global because idempotency is provider-wide.

CREATE TABLE billing_plan (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(32) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    limits          JSONB NOT NULL DEFAULT '{}'::jsonb,
    price_cents     INTEGER NOT NULL DEFAULT 0,
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    stripe_price_id VARCHAR(255) UNIQUE,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO billing_plan(id, code, name, limits, price_cents, currency, stripe_price_id)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'free', 'Free',
     '{"max_sites":1,"max_cameras_per_site":2,"retention_days":7,"ai_minutes_month":500,"chatbot_messages_month":100,"users_per_tenant":3}'::jsonb,
     0, 'USD', NULL),
    ('10000000-0000-0000-0000-000000000002', 'starter', 'Starter',
     '{"max_sites":3,"max_cameras_per_site":8,"retention_days":30,"ai_minutes_month":5000,"chatbot_messages_month":1000,"users_per_tenant":10}'::jsonb,
     2900, 'USD', NULL),
    ('10000000-0000-0000-0000-000000000003', 'pro', 'Pro',
     '{"max_sites":15,"max_cameras_per_site":30,"retention_days":90,"ai_minutes_month":50000,"chatbot_messages_month":10000,"users_per_tenant":50}'::jsonb,
     9900, 'USD', NULL),
    ('10000000-0000-0000-0000-000000000004', 'enterprise', 'Enterprise',
     '{"max_sites":null,"max_cameras_per_site":null,"retention_days":365,"ai_minutes_month":null,"chatbot_messages_month":null,"users_per_tenant":null,"white_label":true}'::jsonb,
     0, 'USD', NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE tenant
    ADD COLUMN plan_id UUID REFERENCES billing_plan(id);

UPDATE tenant
SET plan_id = '10000000-0000-0000-0000-000000000001'
WHERE plan_id IS NULL;

ALTER TABLE tenant
    ALTER COLUMN plan_id SET NOT NULL,
    ALTER COLUMN plan_id SET DEFAULT '10000000-0000-0000-0000-000000000001';

CREATE TABLE billing_subscription (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    plan_id                UUID NOT NULL REFERENCES billing_plan(id),
    stripe_customer_id     VARCHAR(255) NOT NULL UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    status                 VARCHAR(32) NOT NULL DEFAULT 'incomplete'
        CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
    current_period_end     TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_billing_subscription_tenant UNIQUE (tenant_id)
);
CREATE INDEX idx_billing_subscription_tenant_id ON billing_subscription(tenant_id);
CREATE INDEX idx_billing_subscription_plan_id ON billing_subscription(plan_id);

CREATE TABLE billing_usage_record (
    tenant_id  UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    metric     VARCHAR(80) NOT NULL,
    qty        NUMERIC(18, 3) NOT NULL DEFAULT 0,
    period     VARCHAR(16) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, metric, period)
);
CREATE INDEX idx_billing_usage_record_tenant_id ON billing_usage_record(tenant_id);

CREATE TABLE processed_stripe_event (
    event_id     VARCHAR(255) PRIMARY KEY,
    event_type   VARCHAR(120) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_billing_plan_updated_at BEFORE UPDATE ON billing_plan
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_subscription_updated_at BEFORE UPDATE ON billing_subscription
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON billing_plan, billing_subscription, billing_usage_record, processed_stripe_event TO app_rls, app_admin;

ALTER TABLE billing_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscription FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_subscription
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE billing_usage_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_record FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_usage_record
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
