-- V39a: reconcile the V27 role CHECK drift. The User.Role enum carries
-- USER/APPROVER/SECURITY_OFFICER/ADMIN, but V27 narrowed the DB CHECK to
-- (USER, ADMIN) — so APPROVER/SECURITY_OFFICER writes are currently rejected by
-- the DB. Widen it to the real enum and add PLATFORM_ADMIN (cross-tenant,
-- tenant_id NULL) for the platform bootstrap seed (V39c).
--
-- This only unblocks the constraint; it deliberately does NOT rename/remap rows
-- (ADMIN -> TENANT_ADMIN, etc.). That full RBAC rename touches SecurityConfig and
-- every @PreAuthorize and is a separate, larger pass so it does not destabilise
-- the current authorization surface here.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('USER', 'APPROVER', 'SECURITY_OFFICER', 'ADMIN', 'PLATFORM_ADMIN'));

COMMENT ON COLUMN users.role IS
    'User role. PLATFORM_ADMIN is cross-tenant (tenant_id NULL); all others are tenant-scoped.';
