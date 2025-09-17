package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Vehicle;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

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
    
    // Constructors
    public VehicleDto() {}
    
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
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public UUID getEmployeeId() {
        return employeeId;
    }
    
    public void setEmployeeId(UUID employeeId) {
        this.employeeId = employeeId;
    }
    
    public String getEmployeeName() {
        return employeeName;
    }
    
    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }
    
    public String getLicensePlate() {
        return licensePlate;
    }
    
    public void setLicensePlate(String licensePlate) {
        this.licensePlate = licensePlate;
    }
    
    public Vehicle.VehicleType getVehicleType() {
        return vehicleType;
    }
    
    public void setVehicleType(Vehicle.VehicleType vehicleType) {
        this.vehicleType = vehicleType;
    }
    
    public String getBrand() {
        return brand;
    }
    
    public void setBrand(String brand) {
        this.brand = brand;
    }
    
    public String getModel() {
        return model;
    }
    
    public void setModel(String model) {
        this.model = model;
    }
    
    public String getColor() {
        return color;
    }
    
    public void setColor(String color) {
        this.color = color;
    }
    
    public Integer getYear() {
        return year;
    }
    
    public void setYear(Integer year) {
        this.year = year;
    }
    
    
    public LocalDate getRegistrationDate() {
        return registrationDate;
    }
    
    public void setRegistrationDate(LocalDate registrationDate) {
        this.registrationDate = registrationDate;
    }
    
    public LocalDate getExpiryDate() {
        return expiryDate;
    }
    
    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }
    
    
    public Vehicle.VehicleStatus getStatus() {
        return status;
    }
    
    public void setStatus(Vehicle.VehicleStatus status) {
        this.status = status;
    }
    
    public Vehicle.FuelType getFuelType() {
        return fuelType;
    }
    
    public void setFuelType(Vehicle.FuelType fuelType) {
        this.fuelType = fuelType;
    }
    
    public Integer getCapacity() {
        return capacity;
    }
    
    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    public String getImagePath() {
        return imagePath;
    }
    
    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
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
}
