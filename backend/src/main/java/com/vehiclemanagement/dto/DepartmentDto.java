package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Department;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.UUID;

public class DepartmentDto {
    
    private UUID id;
    
    @NotBlank(message = "Department name is required")
    @Size(max = 100, message = "Department name cannot exceed 100 characters")
    private String name;
    
    @Size(max = 500, message = "Description cannot exceed 500 characters")
    private String description;
    
    private UUID parentId;
    
    private UUID managerId;
    
    private Integer employeeCount;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    // Additional fields for display purposes
    private String parentName;
    private String managerName;
    
    // Constructors
    public DepartmentDto() {}
    
    public DepartmentDto(Department department) {
        this.id = department.getId();
        this.name = department.getName();
        this.description = department.getDescription();
        this.parentId = department.getParentId();
        this.managerId = department.getManagerId();
        this.employeeCount = department.getEmployeeCount();
        this.createdAt = department.getCreatedAt();
        this.updatedAt = department.getUpdatedAt();
        
        // Set parent name if parent exists
        if (department.getParent() != null) {
            this.parentName = department.getParent().getName();
        }
        
        // Set manager name if manager exists
        if (department.getManager() != null) {
            this.managerName = department.getManager().getName();
        }
    }
    
    // Convert DTO to Entity
    public Department toEntity() {
        Department department = new Department();
        department.setId(this.id);
        department.setName(this.name);
        department.setDescription(this.description);
        department.setParentId(this.parentId);
        department.setManagerId(this.managerId);
        department.setEmployeeCount(this.employeeCount != null ? this.employeeCount : 0);
        department.setCreatedAt(this.createdAt);
        department.setUpdatedAt(this.updatedAt);
        return department;
    }
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public UUID getParentId() {
        return parentId;
    }
    
    public void setParentId(UUID parentId) {
        this.parentId = parentId;
    }
    
    public UUID getManagerId() {
        return managerId;
    }
    
    public void setManagerId(UUID managerId) {
        this.managerId = managerId;
    }
    
    public Integer getEmployeeCount() {
        return employeeCount;
    }
    
    public void setEmployeeCount(Integer employeeCount) {
        this.employeeCount = employeeCount;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    public String getParentName() {
        return parentName;
    }
    
    public void setParentName(String parentName) {
        this.parentName = parentName;
    }
    
    public String getManagerName() {
        return managerName;
    }
    
    public void setManagerName(String managerName) {
        this.managerName = managerName;
    }
}
