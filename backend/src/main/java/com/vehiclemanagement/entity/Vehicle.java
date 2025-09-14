package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "vehicles")
public class Vehicle {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull(message = "Employee is required")
    private Employee employee;
    
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
    private VehicleStatus status = VehicleStatus.active;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "fuel_type")
    private FuelType fuelType;
    
    private Integer capacity;
    
    private String notes;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    @OneToMany(mappedBy = "vehicle", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<EntryExitRequest> requests;
    
    // Constructors
    public Vehicle() {}
    
    public Vehicle(Employee employee, String licensePlate, VehicleType vehicleType, LocalDate registrationDate) {
        this.employee = employee;
        this.licensePlate = licensePlate;
        this.vehicleType = vehicleType;
        this.registrationDate = registrationDate;
    }
    
    // Getters and Setters
    public UUID getId() {
        return id;
    }
    
    public void setId(UUID id) {
        this.id = id;
    }
    
    public Employee getEmployee() {
        return employee;
    }
    
    public void setEmployee(Employee employee) {
        this.employee = employee;
    }
    
    public String getLicensePlate() {
        return licensePlate;
    }
    
    public void setLicensePlate(String licensePlate) {
        this.licensePlate = licensePlate;
    }
    
    public VehicleType getVehicleType() {
        return vehicleType;
    }
    
    public void setVehicleType(VehicleType vehicleType) {
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
    
    
    public VehicleStatus getStatus() {
        return status;
    }
    
    public void setStatus(VehicleStatus status) {
        this.status = status;
    }
    
    public FuelType getFuelType() {
        return fuelType;
    }
    
    public void setFuelType(FuelType fuelType) {
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
    
    public List<EntryExitRequest> getRequests() {
        return requests;
    }
    
    public void setRequests(List<EntryExitRequest> requests) {
        this.requests = requests;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    // Enums
    public enum VehicleType {
        car, motorbike, truck, bus
    }
    
    public enum VehicleStatus {
        active, inactive, maintenance, retired
    }
    
    public enum FuelType {
        gasoline, diesel, electric, hybrid
    }
}
