-- Remove unique constraint from position name to allow duplicate names
-- V29__Remove_unique_constraint_from_position_name.sql

-- Drop the unique constraint on position name
ALTER TABLE positions DROP CONSTRAINT IF EXISTS uk_positions_name;

-- Drop the unique index if it exists
DROP INDEX IF EXISTS idx_positions_name_unique;

-- Keep the regular index for performance but remove uniqueness
-- The regular index idx_positions_name should still exist for performance
