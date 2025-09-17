package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.DepartmentDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.service.DepartmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/departments")
@Tag(name = "Department Management", description = "APIs for managing organizational departments")
public class DepartmentController {
    
    @Autowired
    private DepartmentService departmentService;
    
    @GetMapping
    @Operation(summary = "Get all departments with pagination")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved departments"),
        @ApiResponse(responseCode = "400", description = "Invalid request parameters")
    })
    public ResponseEntity<Page<DepartmentDto>> getAllDepartments(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "name") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "asc") String sortDir) {
        
        Page<DepartmentDto> departments = departmentService.getAllDepartments(page, size, sortBy, sortDir);
        return ResponseEntity.ok(departments);
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all departments as a simple list")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved department list")
    public ResponseEntity<List<DepartmentDto>> getAllDepartmentsList() {
        List<DepartmentDto> departments = departmentService.getAllDepartmentsList();
        return ResponseEntity.ok(departments);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get department by ID")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved department"),
        @ApiResponse(responseCode = "404", description = "Department not found")
    })
    public ResponseEntity<DepartmentDto> getDepartmentById(
            @Parameter(description = "Department ID") @PathVariable UUID id) {
        DepartmentDto department = departmentService.getDepartmentById(id);
        return ResponseEntity.ok(department);
    }
    
    @PostMapping
    @Operation(summary = "Create new department")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Department created successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid department data"),
        @ApiResponse(responseCode = "409", description = "Department name already exists")
    })
    public ResponseEntity<DepartmentDto> createDepartment(
            @Parameter(description = "Department data") @Valid @RequestBody DepartmentDto departmentDto) {
        DepartmentDto createdDepartment = departmentService.createDepartment(departmentDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdDepartment);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update existing department")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Department updated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid department data"),
        @ApiResponse(responseCode = "404", description = "Department not found"),
        @ApiResponse(responseCode = "409", description = "Department name already exists")
    })
    public ResponseEntity<DepartmentDto> updateDepartment(
            @Parameter(description = "Department ID") @PathVariable UUID id,
            @Parameter(description = "Updated department data") @Valid @RequestBody DepartmentDto departmentDto) {
        DepartmentDto updatedDepartment = departmentService.updateDepartment(id, departmentDto);
        return ResponseEntity.ok(updatedDepartment);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete department")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Department deleted successfully"),
        @ApiResponse(responseCode = "404", description = "Department not found"),
        @ApiResponse(responseCode = "409", description = "Department has child departments or employees")
    })
    public ResponseEntity<Void> deleteDepartment(
            @Parameter(description = "Department ID") @PathVariable UUID id) {
        departmentService.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/parent/{parentId}")
    @Operation(summary = "Get departments by parent ID")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved child departments")
    public ResponseEntity<List<DepartmentDto>> getDepartmentsByParentId(
            @Parameter(description = "Parent department ID") @PathVariable UUID parentId) {
        List<DepartmentDto> departments = departmentService.getDepartmentsByParentId(parentId);
        return ResponseEntity.ok(departments);
    }
    
    @GetMapping("/root")
    @Operation(summary = "Get root departments (no parent)")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved root departments")
    public ResponseEntity<List<DepartmentDto>> getRootDepartments() {
        List<DepartmentDto> departments = departmentService.getRootDepartments();
        return ResponseEntity.ok(departments);
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search departments by name or description")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved search results")
    public ResponseEntity<List<DepartmentDto>> searchDepartments(
            @Parameter(description = "Search query") @RequestParam String query) {
        List<DepartmentDto> departments = departmentService.searchDepartments(query);
        return ResponseEntity.ok(departments);
    }
    
    @GetMapping("/hierarchy")
    @Operation(summary = "Get department hierarchy")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved department hierarchy")
    public ResponseEntity<List<DepartmentDto>> getDepartmentHierarchy() {
        List<DepartmentDto> departments = departmentService.getDepartmentHierarchy();
        return ResponseEntity.ok(departments);
    }
    
    @GetMapping("/statistics")
    @Operation(summary = "Get department statistics")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved department statistics")
    public ResponseEntity<Map<String, Object>> getDepartmentStatistics() {
        Map<String, Object> statistics = departmentService.getDepartmentStatistics();
        return ResponseEntity.ok(statistics);
    }
    
    @GetMapping("/{id}/employees")
    @Operation(summary = "Get employees in a department")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved department employees"),
        @ApiResponse(responseCode = "404", description = "Department not found")
    })
    public ResponseEntity<List<Employee>> getDepartmentEmployees(
            @Parameter(description = "Department ID") @PathVariable UUID id) {
        List<Employee> employees = departmentService.getDepartmentEmployees(id);
        return ResponseEntity.ok(employees);
    }
    
    @PostMapping("/bulk-delete")
    @Operation(summary = "Bulk delete departments")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Departments deleted successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid request"),
        @ApiResponse(responseCode = "409", description = "Some departments cannot be deleted")
    })
    public ResponseEntity<Void> bulkDeleteDepartments(
            @Parameter(description = "List of department IDs to delete") @RequestBody Map<String, List<UUID>> request) {
        List<UUID> departmentIds = request.get("departmentIds");
        if (departmentIds == null || departmentIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        departmentService.bulkDeleteDepartments(departmentIds);
        return ResponseEntity.noContent().build();
    }
    
    @PatchMapping("/{id}/move")
    @Operation(summary = "Move department to new parent")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Department moved successfully"),
        @ApiResponse(responseCode = "404", description = "Department not found"),
        @ApiResponse(responseCode = "400", description = "Invalid move operation")
    })
    public ResponseEntity<DepartmentDto> moveDepartment(
            @Parameter(description = "Department ID") @PathVariable UUID id,
            @Parameter(description = "New parent ID") @RequestBody Map<String, UUID> request) {
        UUID newParentId = request.get("parentId");
        DepartmentDto movedDepartment = departmentService.moveDepartment(id, newParentId);
        return ResponseEntity.ok(movedDepartment);
    }
    
    @PatchMapping("/{id}/manager")
    @Operation(summary = "Update department manager")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Department manager updated successfully"),
        @ApiResponse(responseCode = "404", description = "Department or manager not found")
    })
    public ResponseEntity<DepartmentDto> updateDepartmentManager(
            @Parameter(description = "Department ID") @PathVariable UUID id,
            @Parameter(description = "Manager ID") @RequestBody Map<String, UUID> request) {
        UUID managerId = request.get("managerId");
        DepartmentDto updatedDepartment = departmentService.updateDepartmentManager(id, managerId);
        return ResponseEntity.ok(updatedDepartment);
    }
    
    @GetMapping("/exists/name")
    @Operation(summary = "Check if department name exists")
    @ApiResponse(responseCode = "200", description = "Successfully checked department name")
    public ResponseEntity<Boolean> checkDepartmentNameExists(
            @Parameter(description = "Department name to check") @RequestParam String name,
            @Parameter(description = "Department ID to exclude from check") @RequestParam(required = false) UUID excludeId) {
        // This should be implemented in the service layer
        boolean exists = false; // TODO: Implement in service
        return ResponseEntity.ok(exists);
    }
}
