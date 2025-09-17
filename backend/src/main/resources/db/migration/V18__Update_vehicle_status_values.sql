-- Migration to update vehicle status values to new entry/exit system
-- V18__Update_vehicle_status_values.sql

-- First, remove the old constraint to allow updating status values
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;

-- Update existing status values to new ones
UPDATE vehicles SET status = 'approved' WHERE status = 'active';
UPDATE vehicles SET status = 'rejected' WHERE status = 'inactive';
UPDATE vehicles SET status = 'exited' WHERE status = 'maintenance';
UPDATE vehicles SET status = 'entered' WHERE status = 'retired';

-- Add new constraint to ensure only valid status values
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check 
    CHECK (status IN ('approved', 'rejected', 'exited', 'entered'));
