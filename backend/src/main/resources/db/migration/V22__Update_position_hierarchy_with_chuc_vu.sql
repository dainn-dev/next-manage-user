-- Update position hierarchy to add "Chức vụ" as root parent
-- V22__Update_position_hierarchy_with_chuc_vu.sql

-- First, create the "Chức vụ" root position
INSERT INTO positions (id, name, description, parent_id, level, min_salary, max_salary, is_active, display_order, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Chức vụ', 'Phân loại chức vụ trong quân đội', NULL, 'CHUC_VU', NULL, NULL, true, 1, NOW(), NOW());

-- Update existing "Sĩ Quan" and "QNCN" positions to be children of "Chức vụ"
DO $$
DECLARE
    chuc_vu_id UUID;
BEGIN
    -- Get the ID of the newly created "Chức vụ" position
    SELECT id INTO chuc_vu_id FROM positions WHERE name = 'Chức vụ' AND level = 'CHUC_VU';
    
    -- Update "Sĩ Quan" position to have "Chức vụ" as parent
    UPDATE positions 
    SET parent_id = chuc_vu_id, 
        display_order = 1,
        updated_at = NOW()
    WHERE name = 'Sĩ Quan' AND level = 'SI_QUAN';
    
    -- Update "QNCN" position to have "Chức vụ" as parent
    UPDATE positions 
    SET parent_id = chuc_vu_id, 
        display_order = 2,
        updated_at = NOW()
    WHERE name = 'QNCN' AND level = 'QNCN';

END $$;
