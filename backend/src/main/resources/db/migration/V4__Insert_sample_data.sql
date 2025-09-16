-- Insert sample employees
INSERT INTO employees (employee_id, name, first_name, last_name, email, phone, department, position, hire_date, birth_date, gender, status, access_level) VALUES
('EMP001', 'Nguyễn Văn An', 'An', 'Nguyễn Văn', 'nguyen.van.an@company.com', '0123456789', 'IT', 'Developer', '2023-01-15', '1990-05-20', 'male', 'active', 'general'),
('EMP002', 'Trần Thị Bình', 'Bình', 'Trần Thị', 'tran.thi.binh@company.com', '0987654321', 'HR', 'HR Manager', '2022-06-10', '1988-12-03', 'female', 'active', 'admin'),
('EMP003', 'Lê Văn Cường', 'Cường', 'Lê Văn', 'le.van.cuong@company.com', '0555123456', 'Finance', 'Accountant', '2023-03-01', '1992-08-15', 'male', 'active', 'general'),
('EMP004', 'Phạm Thị Dung', 'Dung', 'Phạm Thị', 'pham.thi.dung@company.com', '0777123456', 'Operations', 'Operations Manager', '2021-11-20', '1985-04-10', 'female', 'active', 'general'),
('EMP005', 'Hoàng Văn Em', 'Em', 'Hoàng Văn', 'hoang.van.em@company.com', '0333123456', 'IT', 'Senior Developer', '2020-09-05', '1987-07-25', 'male', 'active', 'general');

-- Insert sample vehicles
INSERT INTO vehicles (employee_id, license_plate, vehicle_type, brand, model, color, year, registration_date, expiry_date, status, fuel_type, capacity, notes) VALUES
((SELECT id FROM employees WHERE employee_id = 'EMP001'), '29A-12345', 'car', 'Toyota', 'Camry', 'White', 2020, '2020-01-15', '2025-01-15', 'active', 'gasoline', 5, 'Company car for IT department'),
((SELECT id FROM employees WHERE employee_id = 'EMP002'), '29B-67890', 'car', 'Honda', 'Civic', 'Black', 2019, '2019-03-20', '2024-03-20', 'active', 'gasoline', 5, 'Personal vehicle'),
((SELECT id FROM employees WHERE employee_id = 'EMP003'), '29C-11111', 'motorbike', 'Yamaha', 'Exciter', 'Blue', 2021, '2021-05-10', '2026-05-10', 'active', 'gasoline', 2, 'Motorcycle for commuting'),
((SELECT id FROM employees WHERE employee_id = 'EMP004'), '29D-22222', 'truck', 'Ford', 'Transit', 'White', 2018, '2018-08-15', '2023-08-15', 'maintenance', 'diesel', 15, 'Delivery truck - currently under maintenance'),
((SELECT id FROM employees WHERE employee_id = 'EMP005'), '29E-33333', 'car', 'Hyundai', 'Elantra', 'Silver', 2022, '2022-02-28', '2027-02-28', 'active', 'gasoline', 5, 'New company vehicle');

-- Insert sample entry/exit requests
INSERT INTO entry_exit_requests (employee_id, vehicle_id, request_type, request_time, status, notes) VALUES
((SELECT id FROM employees WHERE employee_id = 'EMP001'), (SELECT id FROM vehicles WHERE license_plate = '29A-12345'), 'entry', '2024-01-15 08:30:00+07', 'approved', 'Morning entry for work'),
((SELECT id FROM employees WHERE employee_id = 'EMP001'), (SELECT id FROM vehicles WHERE license_plate = '29A-12345'), 'exit', '2024-01-15 17:30:00+07', 'approved', 'End of work day'),
((SELECT id FROM employees WHERE employee_id = 'EMP002'), (SELECT id FROM vehicles WHERE license_plate = '29B-67890'), 'entry', '2024-01-15 09:00:00+07', 'pending', 'Late arrival'),
((SELECT id FROM employees WHERE employee_id = 'EMP003'), (SELECT id FROM vehicles WHERE license_plate = '29C-11111'), 'entry', '2024-01-15 08:15:00+07', 'approved', 'Regular entry'),
((SELECT id FROM employees WHERE employee_id = 'EMP004'), (SELECT id FROM vehicles WHERE license_plate = '29D-22222'), 'exit', '2024-01-15 16:45:00+07', 'pending', 'Vehicle under maintenance'),
((SELECT id FROM employees WHERE employee_id = 'EMP005'), (SELECT id FROM vehicles WHERE license_plate = '29E-33333'), 'entry', '2024-01-15 08:45:00+07', 'approved', 'Regular entry');
