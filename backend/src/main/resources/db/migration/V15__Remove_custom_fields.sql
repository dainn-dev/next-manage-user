-- Remove custom_fields references from the database
-- This migration removes the custom_fields functionality that was previously removed from the codebase

-- Step 1: Drop the custom_fields column from employees table (if it exists)
ALTER TABLE employees DROP COLUMN IF EXISTS custom_fields;

-- Step 2: Drop the custom_fields table entirely (if it exists)
DROP TABLE IF EXISTS custom_fields CASCADE;

-- Step 3: Drop any related functions and triggers (if they exist)
DROP FUNCTION IF EXISTS update_custom_fields_updated_at() CASCADE;

-- Add comment
COMMENT ON TABLE employees IS 'Employee table with custom_fields column removed in V15';
