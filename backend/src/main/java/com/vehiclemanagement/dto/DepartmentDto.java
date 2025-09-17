package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Department;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
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
    
    // Constructor from entity
    public DepartmentDto(Department department) {
        this.id = department.getId();
        this.name = department.getName();
        this.description = department.getDescription();
        this.parentId = department.getParentId();
        this.managerId = department.getManagerId();
        this.employeeCount = department.getEmployeeCount();
        this.createdAt = department.getCreatedAt();
        this.updatedAt = department.getUpdatedAt();
    }
    
    // Convert to entity
    public Department toEntity() {
        return Department.builder()
                .id(this.id)
                .name(this.name)
                .description(this.description)
                .parentId(this.parentId)
                .managerId(this.managerId)
                .employeeCount(this.employeeCount)
                .createdAt(this.createdAt)
                .updatedAt(this.updatedAt)
                .build();
    }
}