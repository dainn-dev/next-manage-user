package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.EntryExitRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public class EntryExitRequestDto {
    
    private UUID id;
    
    private UUID employeeId;
    
    private String employeeName;
    
    private UUID vehicleId;
    
    private String licensePlate;
    
    @NotNull(message = "Request type is required")
    private EntryExitRequest.RequestType requestType;
    
    @NotNull(message = "Request time is required")
    private LocalDateTime requestTime;
    
    private String approvedBy;
    
    private LocalDateTime approvedAt;
    
    private EntryExitRequest.RequestStatus status;
    
    private String notes;
    
    private LocalDateTime createdAt;
    
    // Constructors
    public EntryExitRequestDto() {}
    
    public EntryExitRequestDto(EntryExitRequest request) {
        this.id = request.getId();
        this.employeeId = request.getEmployee().getId();
        this.employeeName = request.getEmployee().getName();
        this.vehicleId = request.getVehicle().getId();
        this.licensePlate = request.getVehicle().getLicensePlate();
        this.requestType = request.getRequestType();
        this.requestTime = request.getRequestTime();
        this.approvedBy = request.getApprovedBy();
        this.approvedAt = request.getApprovedAt();
        this.status = request.getStatus();
        this.notes = request.getNotes();
        this.createdAt = request.getCreatedAt();
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
    
    public UUID getVehicleId() {
        return vehicleId;
    }
    
    public void setVehicleId(UUID vehicleId) {
        this.vehicleId = vehicleId;
    }
    
    public String getLicensePlate() {
        return licensePlate;
    }
    
    public void setLicensePlate(String licensePlate) {
        this.licensePlate = licensePlate;
    }
    
    public EntryExitRequest.RequestType getRequestType() {
        return requestType;
    }
    
    public void setRequestType(EntryExitRequest.RequestType requestType) {
        this.requestType = requestType;
    }
    
    public LocalDateTime getRequestTime() {
        return requestTime;
    }
    
    public void setRequestTime(LocalDateTime requestTime) {
        this.requestTime = requestTime;
    }
    
    public String getApprovedBy() {
        return approvedBy;
    }
    
    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }
    
    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }
    
    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }
    
    public EntryExitRequest.RequestStatus getStatus() {
        return status;
    }
    
    public void setStatus(EntryExitRequest.RequestStatus status) {
        this.status = status;
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
}
