package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.EmployeeDto;
import com.vehiclemanagement.dto.EmployeeStatisticsDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.vehiclemanagement.util.ImageProcessingUtil;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.LocalDate;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EmployeeService {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private ImageProcessingUtil imageProcessingUtil;

    public Page<EmployeeDto> getAllEmployees(Pageable pageable) {
        return employeeRepository.findAll(pageable).map(EmployeeDto::new);
    }

    public List<EmployeeDto> getAllEmployeesList() {
        return employeeRepository.findAll().stream()
                .map(EmployeeDto::new)
                .collect(Collectors.toList());
    }

    public EmployeeDto getEmployeeById(UUID id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));
        return new EmployeeDto(employee);
    }

    public EmployeeDto getEmployeeByEmployeeId(String employeeId) {
        Employee employee = employeeRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with employee ID: " + employeeId));
        return new EmployeeDto(employee);
    }

    public Page<EmployeeDto> searchEmployees(String searchTerm, Pageable pageable) {
        return employeeRepository.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrEmployeeIdContainingIgnoreCase(
                searchTerm, searchTerm, searchTerm, pageable)
                .map(EmployeeDto::new);
    }

    public Page<EmployeeDto> getEmployeesByDepartment(String department, Pageable pageable) {
        return employeeRepository.findByDepartmentIgnoreCase(department, pageable)
                .map(EmployeeDto::new);
    }

    public Page<EmployeeDto> getEmployeesByStatus(String status, Pageable pageable) {
        try {
            Employee.EmployeeStatus employeeStatus = Employee.EmployeeStatus.valueOf(status.toLowerCase());
            return employeeRepository.findByStatus(employeeStatus, pageable)
                    .map(EmployeeDto::new);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
    }

    public EmployeeDto createEmployee(EmployeeDto employeeDto) {
        // Check if employee ID already exists
        if (employeeRepository.findByEmployeeId(employeeDto.getEmployeeId()).isPresent()) {
            throw new IllegalArgumentException("Employee ID already exists: " + employeeDto.getEmployeeId());
        }

        // Check if email already exists
        if (employeeRepository.findByEmail(employeeDto.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists: " + employeeDto.getEmail());
        }

        Employee employee = new Employee();
        employee.setEmployeeId(employeeDto.getEmployeeId());
        employee.setName(employeeDto.getName());
        employee.setFirstName(employeeDto.getFirstName());
        employee.setLastName(employeeDto.getLastName());
        employee.setEmail(employeeDto.getEmail());
        employee.setPhone(employeeDto.getPhone());
        employee.setDepartment(employeeDto.getDepartment());
        employee.setPosition(employeeDto.getPosition());
        employee.setRank(employeeDto.getRank());
        employee.setJobTitle(employeeDto.getJobTitle());
        employee.setMilitaryCivilian(employeeDto.getMilitaryCivilian());
        employee.setHireDate(employeeDto.getHireDate());
        employee.setBirthDate(employeeDto.getBirthDate());
        employee.setGender(employeeDto.getGender());
        employee.setStatus(employeeDto.getStatus() != null ? employeeDto.getStatus() : Employee.EmployeeStatus.active);
        employee.setAccessLevel(employeeDto.getAccessLevel() != null ? employeeDto.getAccessLevel() : Employee.AccessLevel.general);
        employee.setAddress(employeeDto.getAddress());
        employee.setAvatar(employeeDto.getAvatar());
        employee.setEmergencyContact(employeeDto.getEmergencyContact());
        employee.setEmergencyPhone(employeeDto.getEmergencyPhone());
        employee.setSalary(employeeDto.getSalary());
        employee.setPermissions(employeeDto.getPermissions());

        Employee savedEmployee = employeeRepository.save(employee);
        return new EmployeeDto(savedEmployee);
    }

    public EmployeeDto updateEmployee(UUID id, EmployeeDto employeeDto) {
        Employee existingEmployee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));

        // Check if employee ID already exists (excluding current employee)
        if (!existingEmployee.getEmployeeId().equals(employeeDto.getEmployeeId()) &&
            employeeRepository.findByEmployeeId(employeeDto.getEmployeeId()).isPresent()) {
            throw new IllegalArgumentException("Employee ID already exists: " + employeeDto.getEmployeeId());
        }

        // Check if email already exists (excluding current employee)
        if (!existingEmployee.getEmail().equals(employeeDto.getEmail()) &&
            employeeRepository.findByEmail(employeeDto.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists: " + employeeDto.getEmail());
        }

        existingEmployee.setEmployeeId(employeeDto.getEmployeeId());
        existingEmployee.setName(employeeDto.getName());
        existingEmployee.setFirstName(employeeDto.getFirstName());
        existingEmployee.setLastName(employeeDto.getLastName());
        existingEmployee.setEmail(employeeDto.getEmail());
        existingEmployee.setPhone(employeeDto.getPhone());
        existingEmployee.setDepartment(employeeDto.getDepartment());
        existingEmployee.setPosition(employeeDto.getPosition());
        existingEmployee.setRank(employeeDto.getRank());
        existingEmployee.setJobTitle(employeeDto.getJobTitle());
        existingEmployee.setMilitaryCivilian(employeeDto.getMilitaryCivilian());
        existingEmployee.setHireDate(employeeDto.getHireDate());
        existingEmployee.setBirthDate(employeeDto.getBirthDate());
        existingEmployee.setGender(employeeDto.getGender());
        existingEmployee.setStatus(employeeDto.getStatus());
        existingEmployee.setAccessLevel(employeeDto.getAccessLevel());
        existingEmployee.setAddress(employeeDto.getAddress());
        existingEmployee.setAvatar(employeeDto.getAvatar());
        existingEmployee.setEmergencyContact(employeeDto.getEmergencyContact());
        existingEmployee.setEmergencyPhone(employeeDto.getEmergencyPhone());
        existingEmployee.setSalary(employeeDto.getSalary());
        existingEmployee.setPermissions(employeeDto.getPermissions());

        Employee updatedEmployee = employeeRepository.save(existingEmployee);
        return new EmployeeDto(updatedEmployee);
    }

    public void deleteEmployee(UUID id) {
        if (!employeeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Employee not found with id: " + id);
        }
        employeeRepository.deleteById(id);
    }

    public boolean checkEmployeeIdExists(String employeeId) {
        return employeeRepository.findByEmployeeId(employeeId).isPresent();
    }

    public long getEmployeeCountByStatus(String status) {
        try {
            Employee.EmployeeStatus employeeStatus = Employee.EmployeeStatus.valueOf(status.toLowerCase());
            return employeeRepository.countByStatus(employeeStatus);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
    }

    public long getEmployeeCountByDepartment(String department) {
        return employeeRepository.countByDepartmentIgnoreCase(department);
    }

    public EmployeeDto uploadEmployeeImage(UUID id, MultipartFile imageFile) throws IOException {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));

        if (imageFile != null && !imageFile.isEmpty()) {
            // Validate image before processing
            if (!imageProcessingUtil.isValidImage(imageFile)) {
                throw new IllegalArgumentException("Invalid image file");
            }

            // Process and optimize the image
            byte[] processedImageData = imageProcessingUtil.processImage(imageFile);

            // Create directory structure: images/employees
            Path uploadDir = Paths.get("images", "employees");

            // Create directories if they don't exist
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            // Generate unique filename: employeeId_timestamp.jpg
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
            String filename = employee.getEmployeeId() + "_" + timestamp + "." + imageProcessingUtil.getProcessedImageExtension();

            // Save processed image file
            Path filePath = uploadDir.resolve(filename);
            Files.write(filePath, processedImageData);

            // Update employee with image path
            String imagePath = "/images/employees/" + filename;
            employee.setAvatar(imagePath);
            employeeRepository.save(employee);
        }

        return new EmployeeDto(employee);
    }

    // Bulk operations
    public void bulkDeleteEmployees(List<UUID> employeeIds) {
        for (UUID id : employeeIds) {
            if (employeeRepository.existsById(id)) {
                employeeRepository.deleteById(id);
            }
        }
    }

    public List<EmployeeDto> bulkUpdateEmployeeStatus(List<UUID> employeeIds, String status) {
        try {
            Employee.EmployeeStatus employeeStatus = Employee.EmployeeStatus.valueOf(status.toLowerCase());
            List<Employee> employees = employeeRepository.findAllById(employeeIds);
            
            for (Employee employee : employees) {
                employee.setStatus(employeeStatus);
            }
            
            List<Employee> updatedEmployees = employeeRepository.saveAll(employees);
            return updatedEmployees.stream().map(EmployeeDto::new).collect(Collectors.toList());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
    }

    public List<EmployeeDto> bulkUpdateEmployeeDepartment(List<UUID> employeeIds, String department) {
        List<Employee> employees = employeeRepository.findAllById(employeeIds);
        
        for (Employee employee : employees) {
            employee.setDepartment(department);
        }
        
        List<Employee> updatedEmployees = employeeRepository.saveAll(employees);
        return updatedEmployees.stream().map(EmployeeDto::new).collect(Collectors.toList());
    }

    // Validation methods
    public boolean checkEmailExists(String email) {
        return employeeRepository.existsByEmail(email);
    }

    public boolean validateEmployeeId(String employeeId) {
        // Basic validation - can be enhanced with specific rules
        return employeeId != null && !employeeId.trim().isEmpty() && employeeId.length() >= 3;
    }

    // Statistics methods
    public EmployeeStatisticsDto getEmployeeStatistics() {
        long totalEmployees = employeeRepository.count();
        long activeEmployees = employeeRepository.countByStatus(Employee.EmployeeStatus.active);
        long inactiveEmployees = employeeRepository.countByStatus(Employee.EmployeeStatus.inactive);
        long terminatedEmployees = employeeRepository.countByStatus(Employee.EmployeeStatus.terminated);
        
        // Get employees by department
        List<Object[]> deptCounts = employeeRepository.countByDepartment();
        Map<String, Long> employeesByDepartment = new HashMap<>();
        for (Object[] row : deptCounts) {
            employeesByDepartment.put((String) row[0], (Long) row[1]);
        }
        
        // Get employees by status
        Map<String, Long> employeesByStatus = new HashMap<>();
        employeesByStatus.put("active", activeEmployees);
        employeesByStatus.put("inactive", inactiveEmployees);
        employeesByStatus.put("terminated", terminatedEmployees);
        
        // Get employees by access level (simplified)
        Map<String, Long> employeesByAccessLevel = new HashMap<>();
        employeesByAccessLevel.put("general", employeeRepository.count());
        employeesByAccessLevel.put("admin", 0L); // This would need a more complex query
        
        // Calculate average age (simplified)
        double averageAge = 35.0; // This would need a more complex calculation
        
        // New employees this month/year (simplified)
        long newEmployeesThisMonth = 0L;
        long newEmployeesThisYear = 0L;
        
        return new EmployeeStatisticsDto(
            totalEmployees,
            activeEmployees,
            inactiveEmployees,
            terminatedEmployees,
            employeesByDepartment,
            employeesByStatus,
            employeesByAccessLevel,
            averageAge,
            newEmployeesThisMonth,
            newEmployeesThisYear
        );
    }
}
