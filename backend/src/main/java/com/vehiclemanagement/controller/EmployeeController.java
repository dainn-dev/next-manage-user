package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.EmployeeDto;
import com.vehiclemanagement.dto.EmployeeStatisticsDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.service.EmployeeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/employees")
@Tag(name = "Employee Management", description = "APIs for managing employees")
public class EmployeeController {

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @GetMapping
    @Operation(summary = "Get all employees with pagination", description = "Retrieve a paginated list of all employees")
    public ResponseEntity<Page<EmployeeDto>> getAllEmployees(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EmployeeDto> employees = employeeService.getAllEmployees(pageable);
        return ResponseEntity.ok(employees);
    }

    @GetMapping("/list")
    @Operation(summary = "Get all employees as list", description = "Retrieve all employees without pagination")
    public ResponseEntity<List<EmployeeDto>> getAllEmployeesList() {
        List<EmployeeDto> employees = employeeService.getAllEmployeesList();
        return ResponseEntity.ok(employees);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get employee by ID", description = "Retrieve a specific employee by their ID")
    public ResponseEntity<EmployeeDto> getEmployeeById(@PathVariable UUID id) {
        EmployeeDto employee = employeeService.getEmployeeById(id);
        return ResponseEntity.ok(employee);
    }

    @GetMapping("/employee-id/{employeeId}")
    @Operation(summary = "Get employee by employee ID", description = "Retrieve a specific employee by their employee ID")
    public ResponseEntity<EmployeeDto> getEmployeeByEmployeeId(@PathVariable String employeeId) {
        EmployeeDto employee = employeeService.getEmployeeByEmployeeId(employeeId);
        return ResponseEntity.ok(employee);
    }

    @GetMapping("/search")
    @Operation(summary = "Search employees", description = "Search employees by name, email, or employee ID")
    public ResponseEntity<Page<EmployeeDto>> searchEmployees(
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EmployeeDto> employees = employeeService.searchEmployees(searchTerm, pageable);
        return ResponseEntity.ok(employees);
    }

    @GetMapping("/department/{department}")
    @Operation(summary = "Get employees by department", description = "Retrieve employees filtered by department")
    public ResponseEntity<Page<EmployeeDto>> getEmployeesByDepartment(
            @PathVariable String department,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EmployeeDto> employees = employeeService.getEmployeesByDepartment(department, pageable);
        return ResponseEntity.ok(employees);
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get employees by status", description = "Retrieve employees filtered by status")
    public ResponseEntity<Page<EmployeeDto>> getEmployeesByStatus(
            @PathVariable String status,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction (asc/desc)") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("asc") ? 
            Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EmployeeDto> employees = employeeService.getEmployeesByStatus(status, pageable);
        return ResponseEntity.ok(employees);
    }

    @PostMapping
    @Operation(summary = "Create new employee", description = "Create a new employee")
    public ResponseEntity<EmployeeDto> createEmployee(@Valid @RequestBody EmployeeDto employeeDto) {
        EmployeeDto createdEmployee = employeeService.createEmployee(employeeDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdEmployee);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update employee", description = "Update an existing employee")
    public ResponseEntity<EmployeeDto> updateEmployee(@PathVariable UUID id, @Valid @RequestBody EmployeeDto employeeDto) {
        EmployeeDto updatedEmployee = employeeService.updateEmployee(id, employeeDto);
        return ResponseEntity.ok(updatedEmployee);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete employee", description = "Delete an employee by ID")
    public ResponseEntity<Void> deleteEmployee(@PathVariable UUID id) {
        employeeService.deleteEmployee(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/exists/employee-id/{employeeId}")
    @Operation(summary = "Check if employee ID exists", description = "Check if an employee ID already exists")
    public ResponseEntity<Boolean> checkEmployeeIdExists(@PathVariable String employeeId) {
        boolean exists = employeeService.checkEmployeeIdExists(employeeId);
        return ResponseEntity.ok(exists);
    }

    @GetMapping("/stats/count/status/{status}")
    @Operation(summary = "Get employee count by status", description = "Get the count of employees with a specific status")
    public ResponseEntity<Long> getEmployeeCountByStatus(@PathVariable String status) {
        long count = employeeService.getEmployeeCountByStatus(status);
        return ResponseEntity.ok(count);
    }

    @GetMapping("/stats/count/department/{department}")
    @Operation(summary = "Get employee count by department", description = "Get the count of employees in a specific department")
    public ResponseEntity<Long> getEmployeeCountByDepartment(@PathVariable String department) {
        long count = employeeService.getEmployeeCountByDepartment(department);
        return ResponseEntity.ok(count);
    }

    @PostMapping(value = "/{id}/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload employee image", description = "Upload an image for a specific employee")
    public ResponseEntity<EmployeeDto> uploadEmployeeImage(
            @PathVariable UUID id,
            @Parameter(description = "Image file to upload") @RequestParam("image") MultipartFile imageFile) {
        try {
            EmployeeDto updatedEmployee = employeeService.uploadEmployeeImage(id, imageFile);
            return ResponseEntity.ok(updatedEmployee);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Bulk operations
    @PostMapping("/bulk-delete")
    @Operation(summary = "Bulk delete employees", description = "Delete multiple employees by their IDs")
    public ResponseEntity<Void> bulkDeleteEmployees(@RequestBody List<UUID> employeeIds) {
        try {
            employeeService.bulkDeleteEmployees(employeeIds);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/bulk-update-status")
    @Operation(summary = "Bulk update employee status", description = "Update status for multiple employees")
    public ResponseEntity<List<EmployeeDto>> bulkUpdateEmployeeStatus(
            @RequestBody List<UUID> employeeIds,
            @RequestParam String status) {
        try {
            List<EmployeeDto> updatedEmployees = employeeService.bulkUpdateEmployeeStatus(employeeIds, status);
            return ResponseEntity.ok(updatedEmployees);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/bulk-update-department")
    @Operation(summary = "Bulk update employee department", description = "Update department for multiple employees")
    public ResponseEntity<List<EmployeeDto>> bulkUpdateEmployeeDepartment(
            @RequestBody List<UUID> employeeIds,
            @RequestParam String department) {
        try {
            List<EmployeeDto> updatedEmployees = employeeService.bulkUpdateEmployeeDepartment(employeeIds, department);
            return ResponseEntity.ok(updatedEmployees);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // Additional validation endpoints
    @GetMapping("/exists/email/{email}")
    @Operation(summary = "Check if email exists", description = "Check if an email already exists")
    public ResponseEntity<Boolean> checkEmailExists(@PathVariable String email) {
        boolean exists = employeeService.checkEmailExists(email);
        return ResponseEntity.ok(exists);
    }

    @GetMapping("/validate/employee-id/{employeeId}")
    @Operation(summary = "Validate employee ID format", description = "Validate if employee ID format is correct")
    public ResponseEntity<Boolean> validateEmployeeId(@PathVariable String employeeId) {
        boolean isValid = employeeService.validateEmployeeId(employeeId);
        return ResponseEntity.ok(isValid);
    }

    // Statistics endpoints
    @GetMapping("/stats/overview")
    @Operation(summary = "Get employee statistics overview", description = "Get comprehensive employee statistics")
    public ResponseEntity<EmployeeStatisticsDto> getEmployeeStatistics() {
        EmployeeStatisticsDto stats = employeeService.getEmployeeStatistics();
        return ResponseEntity.ok(stats);
    }
}
