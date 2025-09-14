package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.VehicleDto;
import com.vehiclemanagement.dto.VehicleCreateResponse;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.service.VehicleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/vehicles")
@Tag(name = "Vehicle Management", description = "APIs for managing vehicles")
@CrossOrigin(origins = "*")
public class VehicleController {
    
    @Autowired
    private VehicleService vehicleService;
    
    @GetMapping
    @Operation(summary = "Get all vehicles", description = "Retrieve all vehicles with optional pagination and sorting")
    public ResponseEntity<Page<VehicleDto>> getAllVehicles(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<VehicleDto> vehicles = vehicleService.getAllVehicles(pageable);
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all vehicles as list", description = "Retrieve all vehicles without pagination")
    public ResponseEntity<List<VehicleDto>> getAllVehiclesList() {
        List<VehicleDto> vehicles = vehicleService.getAllVehicles();
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get vehicle by ID", description = "Retrieve a specific vehicle by its ID")
    public ResponseEntity<VehicleDto> getVehicleById(@PathVariable UUID id) {
        VehicleDto vehicle = vehicleService.getVehicleById(id);
        return ResponseEntity.ok(vehicle);
    }
    
    @GetMapping("/license-plate/{licensePlate}")
    @Operation(summary = "Get vehicle by license plate", description = "Retrieve a specific vehicle by its license plate")
    public ResponseEntity<VehicleDto> getVehicleByLicensePlate(@PathVariable String licensePlate) {
        VehicleDto vehicle = vehicleService.getVehicleByLicensePlate(licensePlate);
        return ResponseEntity.ok(vehicle);
    }
    
    @GetMapping("/employee/{employeeId}")
    @Operation(summary = "Get vehicles by employee", description = "Retrieve all vehicles owned by a specific employee")
    public ResponseEntity<List<VehicleDto>> getVehiclesByEmployee(@PathVariable UUID employeeId) {
        List<VehicleDto> vehicles = vehicleService.getVehiclesByEmployee(employeeId);
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/type/{vehicleType}")
    @Operation(summary = "Get vehicles by type", description = "Retrieve all vehicles of a specific type")
    public ResponseEntity<List<VehicleDto>> getVehiclesByType(@PathVariable Vehicle.VehicleType vehicleType) {
        List<VehicleDto> vehicles = vehicleService.getVehiclesByType(vehicleType);
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/status/{status}")
    @Operation(summary = "Get vehicles by status", description = "Retrieve all vehicles with a specific status")
    public ResponseEntity<List<VehicleDto>> getVehiclesByStatus(@PathVariable Vehicle.VehicleStatus status) {
        List<VehicleDto> vehicles = vehicleService.getVehiclesByStatus(status);
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search vehicles", description = "Search vehicles by various criteria")
    public ResponseEntity<Page<VehicleDto>> searchVehicles(
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<VehicleDto> vehicles = vehicleService.searchVehicles(searchTerm, pageable);
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/search/type/{vehicleType}")
    @Operation(summary = "Search vehicles by type", description = "Search vehicles of a specific type")
    public ResponseEntity<Page<VehicleDto>> searchVehiclesByType(
            @PathVariable Vehicle.VehicleType vehicleType,
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<VehicleDto> vehicles = vehicleService.searchVehiclesByType(vehicleType, searchTerm, pageable);
        return ResponseEntity.ok(vehicles);
    }
    
    @GetMapping("/search/status/{status}")
    @Operation(summary = "Search vehicles by status", description = "Search vehicles with a specific status")
    public ResponseEntity<Page<VehicleDto>> searchVehiclesByStatus(
            @PathVariable Vehicle.VehicleStatus status,
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<VehicleDto> vehicles = vehicleService.searchVehiclesByStatus(status, searchTerm, pageable);
        return ResponseEntity.ok(vehicles);
    }
    
    @PostMapping
    @Operation(summary = "Create a new vehicle", description = "Create a new vehicle record or return existing vehicle if license plate already exists")
    public ResponseEntity<VehicleCreateResponse> createVehicle(@Valid @RequestBody VehicleDto vehicleDto) {
        VehicleCreateResponse result = vehicleService.createVehicle(vehicleDto);
        return new ResponseEntity<>(result, HttpStatus.CREATED);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update vehicle", description = "Update an existing vehicle")
    public ResponseEntity<VehicleDto> updateVehicle(@PathVariable UUID id, @Valid @RequestBody VehicleDto vehicleDto) {
        VehicleDto updatedVehicle = vehicleService.updateVehicle(id, vehicleDto);
        return ResponseEntity.ok(updatedVehicle);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete vehicle", description = "Delete a vehicle by ID")
    public ResponseEntity<Void> deleteVehicle(@PathVariable UUID id) {
        vehicleService.deleteVehicle(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/exists/license-plate/{licensePlate}")
    @Operation(summary = "Check if license plate exists", description = "Check if a license plate is already registered")
    public ResponseEntity<Boolean> existsByLicensePlate(@PathVariable String licensePlate) {
        boolean exists = vehicleService.existsByLicensePlate(licensePlate);
        return ResponseEntity.ok(exists);
    }
    
    @GetMapping("/stats/count/status/{status}")
    @Operation(summary = "Get vehicle count by status", description = "Get the count of vehicles with a specific status")
    public ResponseEntity<Long> getVehicleCountByStatus(@PathVariable Vehicle.VehicleStatus status) {
        long count = vehicleService.getVehicleCountByStatus(status);
        return ResponseEntity.ok(count);
    }
    
    @GetMapping("/stats/count/type")
    @Operation(summary = "Get vehicle count by type", description = "Get the count of vehicles grouped by type")
    public ResponseEntity<List<Object[]>> getVehicleCountByType() {
        List<Object[]> counts = vehicleService.getVehicleCountByType();
        return ResponseEntity.ok(counts);
    }
    
    @GetMapping("/stats/count/fuel-type")
    @Operation(summary = "Get vehicle count by fuel type", description = "Get the count of vehicles grouped by fuel type")
    public ResponseEntity<List<Object[]>> getVehicleCountByFuelType() {
        List<Object[]> counts = vehicleService.getVehicleCountByFuelType();
        return ResponseEntity.ok(counts);
    }
}
