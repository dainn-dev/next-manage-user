-- V45 (DAI-268): physically separate login for platform-admin operations.
--
-- app_admin remains the NOLOGIN BYPASSRLS role with CRUD grants from V43.
-- This login owns no schema objects and is not used for request traffic; it is
-- only for the admin Hikari pool selected by @PlatformAdminOperation.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin_login') THEN
        CREATE ROLE app_admin_login LOGIN NOSUPERUSER BYPASSRLS;
    ELSE
        ALTER ROLE app_admin_login WITH LOGIN NOSUPERUSER BYPASSRLS;
    END IF;
END $$;

GRANT app_admin TO app_admin_login;
