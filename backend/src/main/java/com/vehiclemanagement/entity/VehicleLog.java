package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vehicle_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(name = "license_plate_number", nullable = false)
    @NotBlank(message = "License plate number is required")
    private String licensePlateNumber;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;
    
    @Column(name = "entry_exit_time", nullable = false)
    @NotNull(message = "Entry/Exit time is required")
    private LocalDateTime entryExitTime;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    @NotNull(message = "Type is required")
    private LogType type;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "vehicle_type", nullable = false)
    @NotNull(message = "Vehicle type is required")
    private VehicleCategory vehicleType;
    
    @Column(name = "driver_name")
    private String driverName;
    
    private String purpose;
    
    @Column(name = "gate_location")
    private String gateLocation;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "security_guard_id")
    private Employee securityGuard;
    
    private String notes;
    
    @Column(name = "image_path")
    private String imagePath;
    
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
    
    // Enums
    public enum LogType {
        entry, exit
    }
    
    public enum VehicleCategory {
        internal, external
    }
}
