-- Password recovery state is deliberately stored outside tenant-scoped request data.
-- The application reaches these tables only through the existing admin datasource
-- path; app_auth remains read-only and receives no grants here.

ALTER TABLE users
    ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN password_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_fingerprint CHAR(64) NOT NULL,
    request_ip_fingerprint CHAR(64) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_password_reset_tokens_user_id
    ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_email_fingerprint
    ON password_reset_tokens(email_fingerprint);
CREATE INDEX idx_password_reset_tokens_expires_at
    ON password_reset_tokens(expires_at);

CREATE TABLE password_reset_rate_limits (
    scope VARCHAR(16) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER NOT NULL,
    CONSTRAINT pk_password_reset_rate_limits PRIMARY KEY (scope, fingerprint),
    CONSTRAINT ck_password_reset_rate_limits_scope CHECK (scope IN ('email', 'ip')),
    CONSTRAINT ck_password_reset_rate_limits_count CHECK (request_count >= 0)
);

-- The pre-tenant app_auth role is intentionally not granted access to either
-- reset table and cannot update users. Password recovery uses app_admin_login,
-- selected only by @PlatformAdminOperation.
REVOKE ALL ON password_reset_tokens FROM PUBLIC, app_rls, app_auth;
REVOKE ALL ON password_reset_rate_limits FROM PUBLIC, app_rls, app_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_rate_limits TO app_admin;
