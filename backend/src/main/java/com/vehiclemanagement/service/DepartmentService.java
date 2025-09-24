package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.DepartmentDto;
import com.vehiclemanagement.entity.Department;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.DepartmentRepository;
import com.vehiclemanagement.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class DepartmentService {
    
    @Autowired
    private DepartmentRepository departmentRepository;
    
    @Autowired
    private EmployeeRepository employeeRepository;
    
    /**
     * Get all departments with pagination
     */
    public Page<DepartmentDto> getAllDepartments(int page, int size, String sortBy, String sortDir) {
        Sort.Direction direction = sortDir.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        
        Page<Department> departmentPage = departmentRepository.findAll(pageable);
        return departmentPage.map(this::convertToDto);
    }
    
    /**
     * Get all departments as a simple list
     */
    public List<DepartmentDto> getAllDepartmentsList() {
        List<Department> departments = departmentRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return departments.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get department by ID
     */
    public DepartmentDto getDepartmentById(UUID id) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + id));
        return convertToDto(department);
    }
    
    /**
     * Create new department
     */
    public DepartmentDto createDepartment(DepartmentDto departmentDto) {
        // Check if department name already exists
        if (departmentRepository.findByNameIgnoreCase(departmentDto.getName()).isPresent()) {
            throw new IllegalArgumentException("Department with name '" + departmentDto.getName() + "' already exists");
        }
        
        Department department = new Department();
        department.setName(departmentDto.getName());
        department.setDescription(departmentDto.getDescription());
        department.setParentId(departmentDto.getParentId());
        department.setManagerId(departmentDto.getManagerId());
        department.setEmployeeCount(0); // Initialize with 0 employees
        
        Department savedDepartment = departmentRepository.save(department);
        return convertToDto(savedDepartment);
    }
    
    /**
     * Update existing department
     */
    public DepartmentDto updateDepartment(UUID id, DepartmentDto departmentDto) {
        Department existingDepartment = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + id));
        
        // Check if new name conflicts with existing departments (excluding current one)
        if (!existingDepartment.getName().equalsIgnoreCase(departmentDto.getName()) &&
            departmentRepository.existsByNameIgnoreCaseAndIdNot(departmentDto.getName(), id)) {
            throw new IllegalArgumentException("Department with name '" + departmentDto.getName() + "' already exists");
        }
        
        existingDepartment.setName(departmentDto.getName());
        existingDepartment.setDescription(departmentDto.getDescription());
        existingDepartment.setParentId(departmentDto.getParentId());
        existingDepartment.setManagerId(departmentDto.getManagerId());
        
        Department updatedDepartment = departmentRepository.save(existingDepartment);
        return convertToDto(updatedDepartment);
    }
    
    /**
     * Delete department
     */
    public void deleteDepartment(UUID id) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + id));
        
        // Check if department has child departments
        List<Department> children = departmentRepository.findByParentIdOrderByName(id);
        if (!children.isEmpty()) {
            throw new IllegalStateException("Cannot delete department with child departments. Please delete or reassign child departments first.");
        }
        
        // Check if department has employees
        long employeeCount = employeeRepository.countByDepartment(department.getName());
        if (employeeCount > 0) {
            throw new IllegalStateException("Cannot delete department with employees. Please reassign employees first.");
        }
        
        departmentRepository.delete(department);
    }
    
    /**
     * Get departments by parent ID
     */
    public List<DepartmentDto> getDepartmentsByParentId(UUID parentId) {
        List<Department> departments = departmentRepository.findByParentIdOrderByName(parentId);
        return departments.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get root departments
     */
    public List<DepartmentDto> getRootDepartments() {
        List<Department> departments = departmentRepository.findRootDepartments();
        return departments.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Search departments
     */
    public List<DepartmentDto> searchDepartments(String query) {
        List<Department> departments = departmentRepository.searchByNameOrDescription(query);
        return departments.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get department hierarchy
     */
    public List<DepartmentDto> getDepartmentHierarchy() {
        // Get all departments and build hierarchy manually since JPA relationships are not defined
        List<Department> departments = departmentRepository.findAll();
        return departments.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Get employees in a department
     */
    public List<Employee> getDepartmentEmployees(UUID departmentId) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + departmentId));
        
        // Get employees by department name
        List<Employee> employees = employeeRepository.findByDepartment(department.getName());
        
        return employees;
    }
    
    /**
     * Bulk delete departments
     */
    public void bulkDeleteDepartments(List<UUID> departmentIds) {
        for (UUID id : departmentIds) {
            deleteDepartment(id); // This will check for constraints
        }
    }
    
    /**
     * Move department to new parent
     */
    public DepartmentDto moveDepartment(UUID departmentId, UUID newParentId) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + departmentId));
        
        // Validate new parent exists (if provided)
        if (newParentId != null) {
            Department newParent = departmentRepository.findById(newParentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent department not found with id: " + newParentId));
            
            // Prevent circular references
            if (isCircularReference(departmentId, newParentId)) {
                throw new IllegalArgumentException("Cannot move department: would create circular reference");
            }
        }
        
        department.setParentId(newParentId);
        Department updatedDepartment = departmentRepository.save(department);
        return convertToDto(updatedDepartment);
    }
    
    /**
     * Update department manager
     */
    public DepartmentDto updateDepartmentManager(UUID departmentId, UUID managerId) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + departmentId));
        
        // Validate manager exists (if provided)
        if (managerId != null) {
            employeeRepository.findById(managerId)
                    .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + managerId));
        }
        
        department.setManagerId(managerId);
        Department updatedDepartment = departmentRepository.save(department);
        return convertToDto(updatedDepartment);
    }
    
    /**
     * Get department statistics
     */
    public Map<String, Object> getDepartmentStatistics() {
        long totalDepartments = departmentRepository.count();
        Long totalEmployees = departmentRepository.getTotalEmployeeCount();
        if (totalEmployees == null) totalEmployees = 0L;
        
        double averageEmployeesPerDepartment = totalDepartments > 0 ? 
            (double) totalEmployees / totalDepartments : 0;
        
        Optional<Department> largestDept = departmentRepository.findDepartmentWithMaxEmployees();
        
        long parentDepartments = departmentRepository.findRootDepartments().size();
        long childDepartments = totalDepartments - parentDepartments;
        Integer maxDepth = departmentRepository.getMaxHierarchyDepth();
        if (maxDepth == null) maxDepth = 0;
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalDepartments", totalDepartments);
        stats.put("totalEmployees", totalEmployees);
        stats.put("averageEmployeesPerDepartment", Math.round(averageEmployeesPerDepartment));
        
        if (largestDept.isPresent()) {
            Map<String, Object> largest = new HashMap<>();
            largest.put("id", largestDept.get().getId());
            largest.put("name", largestDept.get().getName());
            largest.put("employeeCount", largestDept.get().getEmployeeCount());
            stats.put("largestDepartment", largest);
        }
        
        Map<String, Object> hierarchy = new HashMap<>();
        hierarchy.put("parentDepartments", parentDepartments);
        hierarchy.put("childDepartments", childDepartments);
        hierarchy.put("maxDepth", maxDepth);
        stats.put("departmentHierarchy", hierarchy);
        
        return stats;
    }
    
    /**
     * Update employee count for department
     */
    public void updateEmployeeCount(UUID departmentId) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found with id: " + departmentId));
        
        long employeeCount = employeeRepository.countByDepartment(department.getName());
        department.setEmployeeCount((int) employeeCount);
        departmentRepository.save(department);
    }
    
    /**
     * Check for circular reference in department hierarchy
     */
    private boolean isCircularReference(UUID departmentId, UUID newParentId) {
        if (newParentId == null) return false;
        if (departmentId.equals(newParentId)) return true;
        
        Optional<Department> parentOpt = departmentRepository.findById(newParentId);
        if (parentOpt.isEmpty()) return false;
        
        Department parent = parentOpt.get();
        while (parent.getParentId() != null) {
            if (parent.getParentId().equals(departmentId)) {
                return true;
            }
            Optional<Department> nextParentOpt = departmentRepository.findById(parent.getParentId());
            if (nextParentOpt.isEmpty()) break;
            parent = nextParentOpt.get();
        }
        
        return false;
    }
    
    /**
     * Convert Entity to DTO
     */
    private DepartmentDto convertToDto(Department department) {
        return new DepartmentDto(department);
    }
    
    /**
     * Convert DTO to Entity
     */
    private Department convertToEntity(DepartmentDto departmentDto) {
        return departmentDto.toEntity();
    }
}
