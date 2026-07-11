-- Phase B (ADR-0603): app_auth can read all affiliations at login;
-- parking session + bank-transfer payment for public visits.

-- Allow identity lookup to load every affiliation for a MEMBER (cross-tenant).
DROP POLICY IF EXISTS tenant_isolation ON member_affiliation;
CREATE POLICY tenant_isolation ON member_affiliation
    USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        OR current_user = 'app_auth'
    )
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT ON member_affiliation TO app_auth;

-- Tenant/site bank account for VietQR / SePay transfer instructions.
CREATE TABLE site_parking_bank_account (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    site_id         UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    bank_code       VARCHAR(20) NOT NULL,
    account_number  VARCHAR(50) NOT NULL,
    account_name    VARCHAR(120) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_site_parking_bank_site UNIQUE (site_id)
);

CREATE INDEX idx_site_parking_bank_tenant ON site_parking_bank_account(tenant_id);

ALTER TABLE site_parking_bank_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_parking_bank_account FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON site_parking_bank_account
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON site_parking_bank_account TO app_rls, app_admin;

-- Open/closed parking visit (public gate path).
CREATE TABLE parking_session (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    site_id             UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
    license_plate       VARCHAR(32) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    gate_in_id          UUID REFERENCES gate(id) ON DELETE SET NULL,
    gate_out_id         UUID REFERENCES gate(id) ON DELETE SET NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    claimed_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    qr_token_jti        VARCHAR(64),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT parking_session_status_check
        CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED'))
);

CREATE INDEX idx_parking_session_tenant ON parking_session(tenant_id);
CREATE INDEX idx_parking_session_site ON parking_session(site_id);
CREATE INDEX idx_parking_session_plate ON parking_session(license_plate);
CREATE INDEX idx_parking_session_status ON parking_session(status);
CREATE INDEX idx_parking_session_claimed ON parking_session(claimed_by_user_id);

ALTER TABLE parking_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_session FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON parking_session
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_session TO app_rls, app_admin;

-- Bank-transfer (VietQR / SePay) payment for a session.
CREATE TABLE parking_payment (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid
        REFERENCES tenant(id) ON DELETE CASCADE,
    session_id          UUID NOT NULL REFERENCES parking_session(id) ON DELETE CASCADE,
    amount_vnd          BIGINT NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'VND',
    status              VARCHAR(24) NOT NULL DEFAULT 'AWAITING_TRANSFER',
    transfer_content    VARCHAR(64) NOT NULL,
    bank_account_id     UUID REFERENCES site_parking_bank_account(id) ON DELETE SET NULL,
    paid_at             TIMESTAMPTZ,
    provider            VARCHAR(20) NOT NULL DEFAULT 'SEPAY',
    provider_ref        VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT parking_payment_status_check
        CHECK (status IN ('AWAITING_TRANSFER', 'PAID', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT uq_parking_payment_transfer_content UNIQUE (transfer_content)
);

CREATE INDEX idx_parking_payment_tenant ON parking_payment(tenant_id);
CREATE INDEX idx_parking_payment_session ON parking_payment(session_id);
CREATE INDEX idx_parking_payment_status ON parking_payment(status);

ALTER TABLE parking_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_payment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON parking_payment
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON parking_payment TO app_rls, app_admin;

COMMENT ON TABLE parking_payment IS
    'Driver parking fee via bank transfer (SePay/VietQR). Distinct from SaaS Stripe billing.';
COMMENT ON COLUMN parking_payment.transfer_content IS
    'Unique memo for matching inbound transfers (e.g. PV + short session id).';
