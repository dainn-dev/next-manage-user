-- Remove entry_exit_requests functionality from the database
-- This migration removes the entry/exit request functionality that was removed from the codebase

-- Step 1: Drop the entry_exit_requests table entirely (if it exists)
DROP TABLE IF EXISTS entry_exit_requests CASCADE;

-- Step 2: Drop any related functions and triggers (if they exist)
DROP FUNCTION IF EXISTS update_entry_exit_requests_updated_at() CASCADE;

-- Add comment
COMMENT ON SCHEMA public IS 'Schema with entry_exit_requests table removed in V17';
