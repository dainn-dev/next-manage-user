package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "positions")
public class Position {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(nullable = false, unique = true)
    @NotBlank(message = "Position name is required")
    private String name;
    
    @Column(length = 500)
    private String description;
    
    @Column(name = "parent_id")
    private UUID parentId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PositionLevel level = PositionLevel.JUNIOR;
    
    @Column(name = "min_salary", precision = 12, scale = 2)
    private java.math.BigDecimal minSalary;
    
    @Column(name = "max_salary", precision = 12, scale = 2)
    private java.math.BigDecimal maxSalary;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    @Column(name = "display_order")
    private Integer displayOrder = 0;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    // Self-referencing relationship for parent position
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    private Position parent;
    
    // One-to-many relationship for child positions
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Position> children;
    
    // Constructors
    public Position() {}
    
    public Position(String name, String description, PositionLevel level) {
        this.name = name;
        this.description = description;
        this.level = level;
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
    
    public PositionLevel getLevel() {
        return level;
    }
    
    public void setLevel(PositionLevel level) {
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
    
    public Position getParent() {
        return parent;
    }
    
    public void setParent(Position parent) {
        this.parent = parent;
    }
    
    public List<Position> getChildren() {
        return children;
    }
    
    public void setChildren(List<Position> children) {
        this.children = children;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    // Enums
    public enum PositionLevel {
        INTERN("Thực tập sinh"),
        JUNIOR("Nhân viên"),
        SENIOR("Nhân viên cao cấp"),
        LEAD("Trưởng nhóm"),
        MANAGER("Quản lý"),
        DIRECTOR("Giám đốc"),
        EXECUTIVE("Điều hành");
        
        private final String displayName;
        
        PositionLevel(String displayName) {
            this.displayName = displayName;
        }
        
        public String getDisplayName() {
            return displayName;
        }
    }
}
