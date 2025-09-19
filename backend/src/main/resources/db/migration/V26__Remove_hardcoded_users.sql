-- Remove hardcoded users since we're now using DataSeederService
-- This allows the seeder to create users with properly encoded passwords

-- Remove any existing hardcoded users
DELETE FROM users WHERE username IN ('admin', 'user');
