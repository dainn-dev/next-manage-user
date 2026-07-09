-- DAI-270: first tenant user created by onboarding is a tenant-scoped admin.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('USER', 'APPROVER', 'SECURITY_OFFICER', 'ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN'));
