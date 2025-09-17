-- Migration to add image_path column to vehicles table
-- V19__Add_image_path_to_vehicles.sql

-- Add image_path column to vehicles table
ALTER TABLE vehicles ADD COLUMN image_path VARCHAR(500);

-- Add comment to the column
COMMENT ON COLUMN vehicles.image_path IS 'Path to the vehicle image file';
