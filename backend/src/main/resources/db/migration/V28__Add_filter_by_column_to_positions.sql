-- Add filterBy column to positions table
-- V28__Add_filter_by_column_to_positions.sql

-- Add the filterBy column with constraint
ALTER TABLE positions 
ADD COLUMN filter_by VARCHAR(50) CHECK (filter_by IN ('CO_QUAN_DON_VI', 'CHUC_VU', 'N_A')) DEFAULT 'N_A';

-- Create index for better performance
CREATE INDEX idx_positions_filter_by ON positions(filter_by);

-- Update existing positions based on their names
UPDATE positions 
SET filter_by = 'CHUC_VU' 
WHERE name IN ('Chức vụ', 'Sĩ quan', 'QNCN', 'Trung đội', 'Đại đội', 'Tiểu đoàn', 'Trung đoàn', 'Cơ quan');

-- Set positions that are clearly organizational units
UPDATE positions 
SET filter_by = 'CO_QUAN_DON_VI' 
WHERE name IN ('Tham mưu', 'Chính trị', 'Hậu cần - Kỹ thuật');

-- Comment: 
-- CO_QUAN_DON_VI = "Cơ quan, đơn vị"
-- CHUC_VU = "Chức vụ" 
-- N_A = "N/A"
