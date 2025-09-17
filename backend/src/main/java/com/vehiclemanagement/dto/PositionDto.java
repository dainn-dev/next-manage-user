package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Position;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PositionDto {
    
    private UUID id;
    
    @NotBlank(message = "Position name is required")
    private String name;
    
    private String description;
    private UUID parentId;
    
    @NotNull(message = "Position level is required")
    private Position.PositionLevel level;
    
    private BigDecimal minSalary;
    private BigDecimal maxSalary;
    private Boolean isActive;
    private Integer displayOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Additional fields for frontend display
    private String parentName;
    private Integer childrenCount;
    private String levelDisplayName;
    private Integer employeeCount;
    
    // Constructor from entity
    public PositionDto(Position position) {
        this.id = position.getId();
        this.name = position.getName();
        this.description = position.getDescription();
        this.parentId = position.getParentId();
        this.level = position.getLevel();
        this.minSalary = position.getMinSalary();
        this.maxSalary = position.getMaxSalary();
        this.isActive = position.getIsActive();
        this.displayOrder = position.getDisplayOrder();
        this.createdAt = position.getCreatedAt();
        this.updatedAt = position.getUpdatedAt();
    }
}