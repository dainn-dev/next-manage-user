-- DAI-276: Stripe webhook dunning state and billing audit trail.

ALTER TABLE billing_subscription
    ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN past_due_since TIMESTAMP WITH TIME ZONE;

ALTER TABLE billing_subscription
    DROP CONSTRAINT billing_subscription_status_check,
    ADD CONSTRAINT billing_subscription_status_check
        CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'));

CREATE TABLE billing_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    actor           VARCHAR(80) NOT NULL,
    action          VARCHAR(80) NOT NULL,
    stripe_event_id VARCHAR(255),
    detail          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_billing_audit_tenant_id ON billing_audit(tenant_id);
CREATE INDEX idx_billing_audit_stripe_event_id ON billing_audit(stripe_event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON billing_audit TO app_rls, app_admin;

ALTER TABLE billing_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing_audit
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
