package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.EntryExitRequestDto;
import com.vehiclemanagement.entity.EntryExitRequest;
import com.vehiclemanagement.service.EntryExitRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/entry-exit-requests")
@Tag(name = "Entry/Exit Request Management", description = "APIs for managing entry and exit requests")
@CrossOrigin(origins = "*")
public class EntryExitRequestController {
    
    @Autowired
    private EntryExitRequestService requestService;
    
    @GetMapping
    @Operation(summary = "Get all requests", description = "Retrieve all entry/exit requests with optional pagination and sorting")
    public ResponseEntity<Page<EntryExitRequestDto>> getAllRequests(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EntryExitRequestDto> requests = requestService.getAllRequests(pageable);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all requests as list", description = "Retrieve all entry/exit requests without pagination")
    public ResponseEntity<List<EntryExitRequestDto>> getAllRequestsList() {
        List<EntryExitRequestDto> requests = requestService.getAllRequests();
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get request by ID", description = "Retrieve a specific request by its ID")
    public ResponseEntity<EntryExitRequestDto> getRequestById(@PathVariable UUID id) {
        EntryExitRequestDto request = requestService.getRequestById(id);
        return ResponseEntity.ok(request);
    }
    
    @GetMapping("/employee/{employeeId}")
    @Operation(summary = "Get requests by employee", description = "Retrieve all requests for a specific employee")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByEmployee(@PathVariable UUID employeeId) {
        List<EntryExitRequestDto> requests = requestService.getRequestsByEmployee(employeeId);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/vehicle/{vehicleId}")
    @Operation(summary = "Get requests by vehicle", description = "Retrieve all requests for a specific vehicle")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByVehicle(@PathVariable UUID vehicleId) {
        List<EntryExitRequestDto> requests = requestService.getRequestsByVehicle(vehicleId);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/type/{requestType}")
    @Operation(summary = "Get requests by type", description = "Retrieve all requests of a specific type (entry/exit)")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByType(@PathVariable EntryExitRequest.RequestType requestType) {
        List<EntryExitRequestDto> requests = requestService.getRequestsByType(requestType);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/status/{status}")
    @Operation(summary = "Get requests by status", description = "Retrieve all requests with a specific status")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByStatus(@PathVariable EntryExitRequest.RequestStatus status) {
        List<EntryExitRequestDto> requests = requestService.getRequestsByStatus(status);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search requests", description = "Search requests by various criteria")
    public ResponseEntity<Page<EntryExitRequestDto>> searchRequests(
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EntryExitRequestDto> requests = requestService.searchRequests(searchTerm, pageable);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/search/type/{requestType}")
    @Operation(summary = "Search requests by type", description = "Search requests of a specific type")
    public ResponseEntity<Page<EntryExitRequestDto>> searchRequestsByType(
            @PathVariable EntryExitRequest.RequestType requestType,
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EntryExitRequestDto> requests = requestService.searchRequestsByType(requestType, searchTerm, pageable);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/search/status/{status}")
    @Operation(summary = "Search requests by status", description = "Search requests with a specific status")
    public ResponseEntity<Page<EntryExitRequestDto>> searchRequestsByStatus(
            @PathVariable EntryExitRequest.RequestStatus status,
            @Parameter(description = "Search term") @RequestParam String searchTerm,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "createdAt") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "desc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<EntryExitRequestDto> requests = requestService.searchRequestsByStatus(status, searchTerm, pageable);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/date-range")
    @Operation(summary = "Get requests by date range", description = "Retrieve requests within a specific date range")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByDateRange(
            @Parameter(description = "Start date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        List<EntryExitRequestDto> requests = requestService.getRequestsByDateRange(startDate, endDate);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/employee/{employeeId}/date-range")
    @Operation(summary = "Get employee requests by date range", description = "Retrieve requests for a specific employee within a date range")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByEmployeeAndDateRange(
            @PathVariable UUID employeeId,
            @Parameter(description = "Start date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        List<EntryExitRequestDto> requests = requestService.getRequestsByEmployeeAndDateRange(employeeId, startDate, endDate);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/vehicle/{vehicleId}/date-range")
    @Operation(summary = "Get vehicle requests by date range", description = "Retrieve requests for a specific vehicle within a date range")
    public ResponseEntity<List<EntryExitRequestDto>> getRequestsByVehicleAndDateRange(
            @PathVariable UUID vehicleId,
            @Parameter(description = "Start date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        List<EntryExitRequestDto> requests = requestService.getRequestsByVehicleAndDateRange(vehicleId, startDate, endDate);
        return ResponseEntity.ok(requests);
    }
    
    @PostMapping
    @Operation(summary = "Create a new request", description = "Create a new entry/exit request")
    public ResponseEntity<EntryExitRequestDto> createRequest(@Valid @RequestBody EntryExitRequestDto requestDto) {
        EntryExitRequestDto createdRequest = requestService.createRequest(requestDto);
        return new ResponseEntity<>(createdRequest, HttpStatus.CREATED);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update request", description = "Update an existing request")
    public ResponseEntity<EntryExitRequestDto> updateRequest(@PathVariable UUID id, @Valid @RequestBody EntryExitRequestDto requestDto) {
        EntryExitRequestDto updatedRequest = requestService.updateRequest(id, requestDto);
        return ResponseEntity.ok(updatedRequest);
    }
    
    @PutMapping("/{id}/approve")
    @Operation(summary = "Approve request", description = "Approve a pending request")
    public ResponseEntity<EntryExitRequestDto> approveRequest(
            @PathVariable UUID id,
            @Parameter(description = "Name of the person approving") @RequestParam String approvedBy) {
        EntryExitRequestDto approvedRequest = requestService.approveRequest(id, approvedBy);
        return ResponseEntity.ok(approvedRequest);
    }
    
    @PutMapping("/{id}/reject")
    @Operation(summary = "Reject request", description = "Reject a pending request")
    public ResponseEntity<EntryExitRequestDto> rejectRequest(
            @PathVariable UUID id,
            @Parameter(description = "Name of the person rejecting") @RequestParam String approvedBy) {
        EntryExitRequestDto rejectedRequest = requestService.rejectRequest(id, approvedBy);
        return ResponseEntity.ok(rejectedRequest);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete request", description = "Delete a request by ID")
    public ResponseEntity<Void> deleteRequest(@PathVariable UUID id) {
        requestService.deleteRequest(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/stats/count/status/{status}")
    @Operation(summary = "Get request count by status", description = "Get the count of requests with a specific status")
    public ResponseEntity<Long> getRequestCountByStatus(@PathVariable EntryExitRequest.RequestStatus status) {
        long count = requestService.getRequestCountByStatus(status);
        return ResponseEntity.ok(count);
    }
    
    @GetMapping("/stats/count/type/{requestType}")
    @Operation(summary = "Get request count by type", description = "Get the count of requests of a specific type")
    public ResponseEntity<Long> getRequestCountByType(@PathVariable EntryExitRequest.RequestType requestType) {
        long count = requestService.getRequestCountByType(requestType);
        return ResponseEntity.ok(count);
    }
    
    @GetMapping("/stats/unique-vehicles/date-range")
    @Operation(summary = "Get unique vehicle count in date range", description = "Get the count of unique vehicles in requests within a date range")
    public ResponseEntity<Long> getUniqueVehicleCountInDateRange(
            @Parameter(description = "Start date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        long count = requestService.getUniqueVehicleCountInDateRange(startDate, endDate);
        return ResponseEntity.ok(count);
    }
    
    @GetMapping("/stats/daily")
    @Operation(summary = "Get daily statistics", description = "Get daily request statistics within a date range")
    public ResponseEntity<List<Object[]>> getDailyStats(
            @Parameter(description = "Start date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @Parameter(description = "End date (yyyy-MM-dd'T'HH:mm:ss)") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        
        List<Object[]> stats = requestService.getDailyStats(startDate, endDate);
        return ResponseEntity.ok(stats);
    }
}
