package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.EmployeeDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EmployeeService {

    @Autowired
    private EmployeeRepository employeeRepository;

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
        employee.setHireDate(employeeDto.getHireDate());
        employee.setBirthDate(employeeDto.getBirthDate());
        employee.setGender(employeeDto.getGender());
        employee.setStatus(employeeDto.getStatus() != null ? employeeDto.getStatus() : Employee.EmployeeStatus.active);
        employee.setAccessLevel(employeeDto.getAccessLevel() != null ? employeeDto.getAccessLevel() : Employee.AccessLevel.general);
        employee.setAddress(employeeDto.getAddress());
        employee.setAvatar(employeeDto.getAvatar());
        employee.setCardNumber(employeeDto.getCardNumber());
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
        existingEmployee.setHireDate(employeeDto.getHireDate());
        existingEmployee.setBirthDate(employeeDto.getBirthDate());
        existingEmployee.setGender(employeeDto.getGender());
        existingEmployee.setStatus(employeeDto.getStatus());
        existingEmployee.setAccessLevel(employeeDto.getAccessLevel());
        existingEmployee.setAddress(employeeDto.getAddress());
        existingEmployee.setAvatar(employeeDto.getAvatar());
        existingEmployee.setCardNumber(employeeDto.getCardNumber());
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
}
