package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "entry_exit_requests")
public class EntryExitRequest {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull(message = "Employee is required")
    private Employee employee;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    @NotNull(message = "Vehicle is required")
    private Vehicle vehicle;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false)
    @NotNull(message = "Request type is required")
    private RequestType requestType;
    
    @Column(name = "request_time", nullable = false)
    @NotNull(message = "Request time is required")
    private LocalDateTime requestTime;
    
    @Column(name = "approved_by")
    private String approvedBy;
    
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequestStatus status = RequestStatus.pending;
    
    private String notes;
    
    @Column(name = "entry_image_path")
    private String entryImagePath;
    
    @Column(name = "exit_image_path")
    private String exitImagePath;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    // Constructors
    public EntryExitRequest() {}
    
    public EntryExitRequest(Employee employee, Vehicle vehicle, RequestType requestType, LocalDateTime requestTime) {
        this.employee = employee;
        this.vehicle = vehicle;
        this.requestType = requestType;
        this.requestTime = requestTime;
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
    
    public Vehicle getVehicle() {
        return vehicle;
    }
    
    public void setVehicle(Vehicle vehicle) {
        this.vehicle = vehicle;
    }
    
    public RequestType getRequestType() {
        return requestType;
    }
    
    public void setRequestType(RequestType requestType) {
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
    
    public RequestStatus getStatus() {
        return status;
    }
    
    public void setStatus(RequestStatus status) {
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
    
    public String getEntryImagePath() {
        return entryImagePath;
    }
    
    public void setEntryImagePath(String entryImagePath) {
        this.entryImagePath = entryImagePath;
    }
    
    public String getExitImagePath() {
        return exitImagePath;
    }
    
    public void setExitImagePath(String exitImagePath) {
        this.exitImagePath = exitImagePath;
    }
    
    // Business methods
    public void approve(String approvedBy) {
        this.status = RequestStatus.approved;
        this.approvedBy = approvedBy;
        this.approvedAt = LocalDateTime.now();
    }
    
    
    public void complete() {
        this.status = RequestStatus.completed;
    }
    
    // Enums
    public enum RequestType {
        entry, exit
    }
    
    public enum RequestStatus {
        pending, approved, completed, rejected
    }
}
