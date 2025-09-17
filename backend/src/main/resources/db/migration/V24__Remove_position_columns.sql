-- Remove level, min_salary, max_salary columns from positions table
-- V24__Remove_position_columns.sql

-- Drop the columns
ALTER TABLE positions 
DROP COLUMN IF EXISTS level,
DROP COLUMN IF EXISTS min_salary,
DROP COLUMN IF EXISTS max_salary;
