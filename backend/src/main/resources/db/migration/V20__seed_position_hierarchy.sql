-- Seed hierarchical position data for military structure
-- V20__seed_position_hierarchy.sql

-- Insert root level positions (Sĩ Quan and QNCN)
INSERT INTO positions (id, name, description, parent_id, level, min_salary, max_salary, is_active, display_order, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Sĩ Quan', 'Cấp bậc sĩ quan trong quân đội', NULL, 'SI_QUAN', 15000000, 50000000, true, 1, NOW(), NOW()),
    (gen_random_uuid(), 'QNCN', 'Quân nhân chuyên nghiệp', NULL, 'QNCN', 8000000, 25000000, true, 2, NOW(), NOW());

-- Get the IDs of the parent positions for foreign key references
DO $$
DECLARE
    si_quan_id UUID;
    qncn_id UUID;
    co_quan_qncn_id UUID;
BEGIN
    -- Get Sĩ Quan ID
    SELECT id INTO si_quan_id FROM positions WHERE name = 'Sĩ Quan' AND level = 'SI_QUAN';
    
    -- Get QNCN ID
    SELECT id INTO qncn_id FROM positions WHERE name = 'QNCN' AND level = 'QNCN';
    
    -- Insert Sĩ Quan sub-levels
    INSERT INTO positions (id, name, description, parent_id, level, min_salary, max_salary, is_active, display_order, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), 'Trung đội', 'Cấp trung đội trong quân đội', si_quan_id, 'TRUNG_DOI', 12000000, 18000000, true, 1, NOW(), NOW()),
        (gen_random_uuid(), 'Đại đội', 'Cấp đại đội trong quân đội', si_quan_id, 'DAI_DOI', 15000000, 22000000, true, 2, NOW(), NOW()),
        (gen_random_uuid(), 'Tiểu đoàn', 'Cấp tiểu đoàn trong quân đội', si_quan_id, 'TIEU_DOAN', 18000000, 28000000, true, 3, NOW(), NOW()),
        (gen_random_uuid(), 'Trung đoàn', 'Cấp trung đoàn trong quân đội', si_quan_id, 'TRUNG_DOAN', 25000000, 40000000, true, 4, NOW(), NOW()),
        (gen_random_uuid(), 'Cơ quan (SQ)', 'Cơ quan cấp sĩ quan', si_quan_id, 'CO_QUAN_SQ', 20000000, 35000000, true, 5, NOW(), NOW());
    
    -- Insert QNCN sub-levels
    INSERT INTO positions (id, name, description, parent_id, level, min_salary, max_salary, is_active, display_order, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), 'Tiểu đoàn (QNCN)', 'Cấp tiểu đoàn QNCN', qncn_id, 'TIEU_DOAN_QNCN', 10000000, 18000000, true, 1, NOW(), NOW()),
        (gen_random_uuid(), 'Cơ quan (QNCN)', 'Cơ quan cấp QNCN', qncn_id, 'CO_QUAN_QNCN', 12000000, 20000000, true, 2, NOW(), NOW());
    
    -- Get Cơ quan (QNCN) ID for sub-departments
    SELECT id INTO co_quan_qncn_id FROM positions WHERE name = 'Cơ quan (QNCN)' AND level = 'CO_QUAN_QNCN';
    
    -- Insert Cơ quan (QNCN) sub-departments
    INSERT INTO positions (id, name, description, parent_id, level, min_salary, max_salary, is_active, display_order, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), 'Tham mưu', 'Bộ phận tham mưu', co_quan_qncn_id, 'THAM_MUU', 12000000, 18000000, true, 1, NOW(), NOW()),
        (gen_random_uuid(), 'Chính trị', 'Bộ phận chính trị', co_quan_qncn_id, 'CHINH_TRI', 12000000, 18000000, true, 2, NOW(), NOW()),
        (gen_random_uuid(), 'Hậu cần - Kỹ thuật', 'Bộ phận hậu cần và kỹ thuật', co_quan_qncn_id, 'HAU_CAN_KY_THUAT', 11000000, 17000000, true, 3, NOW(), NOW());

END $$;
