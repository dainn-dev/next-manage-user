package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Vehicle;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleDto {
    
    private UUID id;
    private UUID employeeId;
    private String employeeName;
    
    @NotBlank(message = "License plate is required")
    private String licensePlate;
    
    @NotNull(message = "Vehicle type is required")
    private Vehicle.VehicleType vehicleType;
    
    private String brand;
    private String model;
    private String color;
    private Integer year;
    
    @NotNull(message = "Registration date is required")
    private LocalDate registrationDate;
    
    private LocalDate expiryDate;
    private Vehicle.VehicleStatus status;
    private Vehicle.FuelType fuelType;
    private Integer capacity;
    private String notes;
    private String imagePath;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Constructor from entity
    public VehicleDto(Vehicle vehicle) {
        this.id = vehicle.getId();
        this.employeeId = vehicle.getEmployee().getId();
        this.employeeName = vehicle.getEmployee().getName();
        this.licensePlate = vehicle.getLicensePlate();
        this.vehicleType = vehicle.getVehicleType();
        this.brand = vehicle.getBrand();
        this.model = vehicle.getModel();
        this.color = vehicle.getColor();
        this.year = vehicle.getYear();
        this.registrationDate = vehicle.getRegistrationDate();
        this.expiryDate = vehicle.getExpiryDate();
        this.status = vehicle.getStatus();
        this.fuelType = vehicle.getFuelType();
        this.capacity = vehicle.getCapacity();
        this.notes = vehicle.getNotes();
        this.imagePath = vehicle.getImagePath();
        this.createdAt = vehicle.getCreatedAt();
        this.updatedAt = vehicle.getUpdatedAt();
    }
}