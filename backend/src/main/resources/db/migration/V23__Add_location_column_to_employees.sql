-- Add location column to employees table
-- V23__Add_location_column_to_employees.sql

ALTER TABLE employees 
ADD COLUMN location VARCHAR(255);

COMMENT ON COLUMN employees.location IS 'Vị trí làm việc của quân nhân';
