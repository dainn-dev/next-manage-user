-- Public registration: persist onboarding inputs and enforce canonical uniqueness.
--
-- Earlier migrations are immutable. Existing tenant rows intentionally keep NULL
-- onboarding metadata; all new public registrations provide both values.

ALTER TABLE tenant
    ADD COLUMN management_model VARCHAR(32),
    ADD COLUMN area_count SMALLINT,
    ADD CONSTRAINT chk_tenant_management_model
        CHECK (management_model IS NULL OR management_model IN (
            'boarding-house', 'school', 'retail', 'airport',
            'hospital', 'industrial-park', 'other'
        )),
    ADD CONSTRAINT chk_tenant_area_count
        CHECK (area_count IS NULL OR area_count BETWEEN 1 AND 999);

-- The public registration service treats names, usernames, and email addresses
-- case-insensitively. These indexes make that policy race-safe at the database
-- boundary as well.
CREATE UNIQUE INDEX uq_tenant_name_ci ON tenant (lower(name));
CREATE UNIQUE INDEX uq_users_username_ci ON users (lower(username));
CREATE UNIQUE INDEX uq_users_email_ci ON users (lower(email));
