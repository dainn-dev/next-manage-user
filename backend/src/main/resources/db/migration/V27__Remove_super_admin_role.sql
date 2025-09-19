-- Update existing SUPER_ADMIN users to ADMIN role
UPDATE users SET role = 'ADMIN' WHERE role = 'SUPER_ADMIN';

-- Update the CHECK constraint to remove SUPER_ADMIN
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'));

-- Add comment explaining the change
COMMENT ON COLUMN users.role IS 'User role: USER or ADMIN';
