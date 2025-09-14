-- Add missing employees that are referenced in frontend mock data
INSERT INTO employees (employee_id, name, first_name, last_name, email, phone, department, position, hire_date, birth_date, gender, status, access_level) VALUES
('247', 'Đoàn Đình Độ', 'Đình Độ', 'Đoàn', 'doan.dinh.do@company.com', '0123456790', 'Department Name', 'Trưởng phòng', '2024-12-01', '1980-01-01', 'male', 'active', 'admin'),
('248', 'Nguyễn Duy Linh', 'Duy Linh', 'Nguyễn', 'nguyen.duy.linh@company.com', '0123456789', 'Tiểu Đoàn 8', 'Nhân viên', '2025-01-15', '1985-01-01', 'male', 'active', 'general'),
('246', 'Võ Hữu Trường', 'Hữu Trường', 'Võ', 'vo.huu.truong@company.com', '0123456791', 'Ban Tham Mưu', 'Nhân viên', '2024-11-15', '1988-01-01', 'male', 'active', 'general'),
('245', 'Phạm Thị Thảo', 'Thị Thảo', 'Phạm', 'pham.thi.thao@company.com', '0123456792', 'Ban Tham Mưu', 'Nhân viên', '2024-10-20', '1990-01-01', 'female', 'active', 'general');
