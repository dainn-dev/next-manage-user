package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vehicles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vehicle {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;
    
    @Column(name = "license_plate", unique = true, nullable = false)
    @NotBlank(message = "License plate is required")
    private String licensePlate;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "vehicle_type", nullable = false)
    @NotNull(message = "Vehicle type is required")
    private VehicleType vehicleType;
    
    private String brand;
    private String model;
    private String color;
    private Integer year;
    
    @Column(name = "registration_date", nullable = false)
    @NotNull(message = "Registration date is required")
    private LocalDate registrationDate;
    
    @Column(name = "expiry_date")
    private LocalDate expiryDate;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private VehicleStatus status = VehicleStatus.approved;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "fuel_type")
    private FuelType fuelType;
    
    private Integer capacity;
    private String notes;
    
    @Column(name = "image_path")
    private String imagePath;

    /** Last-known / current branch; stamped from gate on entry. */
    @Column(name = "current_site_id")
    private UUID currentSiteId;

    /** Tenant owner of the whitelist row; stamped by DB default / GUC (not set via JPA). */
    @Column(name = "tenant_id", insertable = false, updatable = false)
    private UUID tenantId;
    
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
    public enum VehicleType {
        car, motorbike, truck, bus
    }
    
    public enum VehicleStatus {
        approved, rejected, exited, entered
    }
    
    public enum FuelType {
        gasoline, diesel, electric, hybrid
    }
}