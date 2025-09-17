package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "positions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
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
    @NotNull(message = "Position level is required")
    private PositionLevel level;
    
    @Column(name = "min_salary", precision = 12, scale = 2)
    private BigDecimal minSalary;
    
    @Column(name = "max_salary", precision = 12, scale = 2)
    private BigDecimal maxSalary;
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "display_order")
    @Builder.Default
    private Integer displayOrder = 0;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
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