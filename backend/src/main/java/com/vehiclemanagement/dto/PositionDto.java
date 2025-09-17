package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Position;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public class PositionDto {
    
    private UUID id;
    
    @NotBlank(message = "Position name is required")
    private String name;
    
    private String description;
    
    private UUID parentId;
    
    @NotNull(message = "Position level is required")
    private Position.PositionLevel level;
    
    private java.math.BigDecimal minSalary;
    
    private java.math.BigDecimal maxSalary;
    
    private Boolean isActive;
    
    private Integer displayOrder;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    // Additional fields for response
    private String parentName;
    
    private Integer childrenCount;
    
    private String levelDisplayName;
    
    // Constructors
    public PositionDto() {}
    
    public PositionDto(String name, String description, Position.PositionLevel level) {
        this.name = name;
        this.description = description;
        this.level = level;
        this.isActive = true;
        this.displayOrder = 0;
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
    
    public Position.PositionLevel getLevel() {
        return level;
    }
    
    public void setLevel(Position.PositionLevel level) {
        this.level = level;
    }
    
    public java.math.BigDecimal getMinSalary() {
        return minSalary;
    }
    
    public void setMinSalary(java.math.BigDecimal minSalary) {
        this.minSalary = minSalary;
    }
    
    public java.math.BigDecimal getMaxSalary() {
        return maxSalary;
    }
    
    public void setMaxSalary(java.math.BigDecimal maxSalary) {
        this.maxSalary = maxSalary;
    }
    
    public Boolean getIsActive() {
        return isActive;
    }
    
    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
    
    public Integer getDisplayOrder() {
        return displayOrder;
    }
    
    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
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
    
    public Integer getChildrenCount() {
        return childrenCount;
    }
    
    public void setChildrenCount(Integer childrenCount) {
        this.childrenCount = childrenCount;
    }
    
    public String getLevelDisplayName() {
        return levelDisplayName;
    }
    
    public void setLevelDisplayName(String levelDisplayName) {
        this.levelDisplayName = levelDisplayName;
    }
}
