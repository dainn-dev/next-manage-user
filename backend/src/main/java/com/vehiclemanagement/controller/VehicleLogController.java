package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.service.VehicleLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/vehicle-logs")
@Tag(name = "Vehicle Log Management", description = "APIs for managing vehicle entry/exit logs")
public class VehicleLogController {
    
    @Autowired
    private VehicleLogService vehicleLogService;
    
    @GetMapping
    @Operation(summary = "Get all vehicle logs", description = "Retrieve all vehicle logs with optional pagination and sorting")
    public ResponseEntity<Page<VehicleLogDto>> getAllVehicleLogs(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "entryExitTime") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<VehicleLogDto> logs = vehicleLogService.getAllVehicleLogs(pageable);
        return ResponseEntity.ok(logs);
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all vehicle logs as list", description = "Retrieve all vehicle logs without pagination")
    public ResponseEntity<List<VehicleLogDto>> getAllVehicleLogsList() {
        List<VehicleLogDto> logs = vehicleLogService.getAllVehicleLogsList();
        return ResponseEntity.ok(logs);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get vehicle log by ID", description = "Retrieve a specific vehicle log by its ID")
    public ResponseEntity<VehicleLogDto> getVehicleLogById(@PathVariable UUID id) {
        VehicleLogDto log = vehicleLogService.getVehicleLogById(id);
        return ResponseEntity.ok(log);
    }
    
    @GetMapping("/today")
    @Operation(summary = "Get today's vehicle logs", description = "Retrieve vehicle logs for today")
    public ResponseEntity<Page<VehicleLogDto>> getTodayLogs(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("entryExitTime").descending());
        Page<VehicleLogDto> logs = vehicleLogService.getTodayLogs(pageable);
        return ResponseEntity.ok(logs);
    }
    
    @GetMapping("/weekly")
    @Operation(summary = "Get this week's vehicle logs", description = "Retrieve vehicle logs for the current week")
    public ResponseEntity<Page<VehicleLogDto>> getWeeklyLogs(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("entryExitTime").descending());
        Page<VehicleLogDto> logs = vehicleLogService.getWeeklyLogs(pageable);
        return ResponseEntity.ok(logs);
    }
    
    @GetMapping("/monthly")
    @Operation(summary = "Get this month's vehicle logs", description = "Retrieve vehicle logs for the current month")
    public ResponseEntity<Page<VehicleLogDto>> getMonthlyLogs(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("entryExitTime").descending());
        Page<VehicleLogDto> logs = vehicleLogService.getMonthlyLogs(pageable);
        return ResponseEntity.ok(logs);
    }
    
    @GetMapping("/date-range")
    @Operation(summary = "Get vehicle logs by date range", description = "Retrieve vehicle logs within a specific date range")
    public ResponseEntity<Page<VehicleLogDto>> getVehicleLogsByDateRange(
            @Parameter(description = "Start date and time") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date and time") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("entryExitTime").descending());
        Page<VehicleLogDto> logs = vehicleLogService.getVehicleLogsByDateRange(startDate, endDate, pageable);
        return ResponseEntity.ok(logs);
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search vehicle logs", description = "Search vehicle logs with various filters")
    public ResponseEntity<Page<VehicleLogDto>> searchVehicleLogs(
            @Parameter(description = "License plate number") @RequestParam(required = false) String licensePlate,
            @Parameter(description = "Log type (entry/exit)") @RequestParam(required = false) String type,
            @Parameter(description = "Vehicle type (internal/external)") @RequestParam(required = false) String vehicleType,
            @Parameter(description = "Driver name") @RequestParam(required = false) String driverName,
            @Parameter(description = "Start date and time") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date and time") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        // Convert string parameters to enums, handling both uppercase and lowercase
        VehicleLog.LogType logType = null;
        if (type != null && !type.trim().isEmpty()) {
            try {
                logType = VehicleLog.LogType.valueOf(type.toLowerCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid log type: " + type + ". Valid values are: entry, exit");
            }
        }
        
        VehicleLog.VehicleCategory vehicleCategoryType = null;
        if (vehicleType != null && !vehicleType.trim().isEmpty()) {
            try {
                vehicleCategoryType = VehicleLog.VehicleCategory.valueOf(vehicleType.toLowerCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid vehicle type: " + vehicleType + ". Valid values are: internal, external");
            }
        }
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("entryExitTime").descending());
        Page<VehicleLogDto> logs = vehicleLogService.searchVehicleLogs(
                licensePlate, logType, vehicleCategoryType, driverName, startDate, endDate, pageable);
        return ResponseEntity.ok(logs);
    }
    
    @PostMapping
    @Operation(summary = "Create vehicle log", description = "Create a new vehicle entry/exit log")
    public ResponseEntity<VehicleLogDto> createVehicleLog(@RequestBody VehicleLogDto vehicleLogDto) {
        VehicleLogDto createdLog = vehicleLogService.createVehicleLog(vehicleLogDto);
        return ResponseEntity.ok(createdLog);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update vehicle log", description = "Update an existing vehicle log")
    public ResponseEntity<VehicleLogDto> updateVehicleLog(@PathVariable UUID id, @RequestBody VehicleLogDto vehicleLogDto) {
        VehicleLogDto updatedLog = vehicleLogService.updateVehicleLog(id, vehicleLogDto);
        return ResponseEntity.ok(updatedLog);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete vehicle log", description = "Delete a vehicle log by ID")
    public ResponseEntity<Void> deleteVehicleLog(@PathVariable UUID id) {
        vehicleLogService.deleteVehicleLog(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/statistics/today")
    @Operation(summary = "Get today's statistics", description = "Get entry/exit statistics for today")
    public ResponseEntity<Object> getTodayStatistics() {
        return ResponseEntity.ok(new Object() {
            public final long entryCount = vehicleLogService.getTodayEntryCount();
            public final long exitCount = vehicleLogService.getTodayExitCount();
            public final long uniqueVehicles = vehicleLogService.getTodayUniqueVehicles();
        });
    }
    
    @GetMapping("/employee-info")
    @Operation(summary = "Get employee info by license plate", description = "Get employee and vehicle information by license plate number and entry/exit type")
    public ResponseEntity<Object> getEmployeeInfoByLicensePlate(
            @Parameter(description = "License plate number") @RequestParam String licensePlateNumber,
            @Parameter(description = "Log type (entry/exit)") @RequestParam String type) {
        // Convert string to enum, handling both uppercase and lowercase
        VehicleLog.LogType logType;
        try {
            logType = VehicleLog.LogType.valueOf(type.toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid log type: " + type + ". Valid values are: entry, exit");
        }
        
        Object employeeInfo = vehicleLogService.getEmployeeInfoByLicensePlate(licensePlateNumber, logType);
        return ResponseEntity.ok(employeeInfo);
    }
}
