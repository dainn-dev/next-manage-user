package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Position;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PositionMenuDto {
    private UUID id;

    @NotBlank(message = "Position name is required")
    private String name;

    private String description;
    private UUID parentId;
    private Boolean isActive;
    private Integer displayOrder;
    private Position.FilterType filterBy;
    private List<PositionMenuDto> children;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Additional fields for frontend display
    private String parentName;
    private Integer childrenCount;

    // Constructor from entity
    public PositionMenuDto(Position position) {
        this.id = position.getId();
        this.name = position.getName();
        this.description = position.getDescription();
        this.parentId = position.getParentId();
        this.isActive = position.getIsActive();
        this.displayOrder = position.getDisplayOrder();
        this.filterBy = position.getFilterBy();
        this.createdAt = position.getCreatedAt();
        this.updatedAt = position.getUpdatedAt();
        this.children = new ArrayList<>();
    }

    // Default constructor
    public PositionMenuDto() {
        this.children = new ArrayList<>();
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public UUID getParentId() { return parentId; }
    public void setParentId(UUID parentId) { this.parentId = parentId; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public Position.FilterType getFilterBy() { return filterBy; }
    public void setFilterBy(Position.FilterType filterBy) { this.filterBy = filterBy; }

    public List<PositionMenuDto> getChildren() { return children; }
    public void setChildren(List<PositionMenuDto> children) { this.children = children; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getParentName() { return parentName; }
    public void setParentName(String parentName) { this.parentName = parentName; }

    public Integer getChildrenCount() { return childrenCount; }
    public void setChildrenCount(Integer childrenCount) { this.childrenCount = childrenCount; }
}
