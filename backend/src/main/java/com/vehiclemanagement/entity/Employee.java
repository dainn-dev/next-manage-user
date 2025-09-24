package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "employees")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "employee_id", unique = true, nullable = false)
    @NotBlank(message = "Employee ID is required")
    private String employeeId;
    
    @NotBlank(message = "Name is required")
    private String name;
    
    @Column(name = "first_name")
    private String firstName;
    
    @Column(name = "last_name")
    private String lastName;
    
    @Column
    private String email;
    
    private String phone;
    
    @NotBlank(message = "Department is required")
    private String department;
    
    @Column(name = "department_id")
    private UUID departmentId;
    
    private String position;
    
    @Column(name = "position_id")
    private UUID positionId;
    private String rank;
    
    @Column(name = "job_title")
    private String jobTitle;
    
    @Column(name = "military_civilian")
    private String militaryCivilian;
    
    private String location;
    
    @Column(name = "hire_date")
    private LocalDate hireDate;
    
    @Column(name = "birth_date")
    private LocalDate birthDate;
    
    @Enumerated(EnumType.STRING)
    private Gender gender;
    
    private String address;
    
    @Column(name = "emergency_contact")
    private String emergencyContact;
    
    @Column(name = "emergency_phone")
    private String emergencyPhone;
    
    @Column(precision = 12, scale = 2)
    private BigDecimal salary;
    
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private EmployeeStatus status = EmployeeStatus.HOAT_DONG;
    
    private String avatar;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "access_level")
    @Builder.Default
    private AccessLevel accessLevel = AccessLevel.general;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> permissions = List.of();
    
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
    public enum Gender {
        male, female, other
    }
    
    public enum EmployeeStatus {
        HOAT_DONG, TRANH_THU, PHEP, LY_DO_KHAC
    }
    
    public enum AccessLevel {
        general, restricted, admin
    }
}