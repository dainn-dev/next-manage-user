package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.PositionDto;
import com.vehiclemanagement.entity.Position;
import com.vehiclemanagement.service.PositionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/positions")
@Tag(name = "Position Management", description = "APIs for managing positions (Chức vụ)")
public class PositionController {
    
    @Autowired
    private PositionService positionService;
    
    @GetMapping
    @Operation(summary = "Get all positions with pagination")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved positions")
    })
    public ResponseEntity<Page<PositionDto>> getAllPositions(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field") @RequestParam(defaultValue = "displayOrder") String sortBy,
            @Parameter(description = "Sort direction") @RequestParam(defaultValue = "asc") String sortDir) {
        
        Sort sort = sortDir.equalsIgnoreCase("desc") ? 
                   Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);
        
        // For now, return all positions as a list converted to page
        List<PositionDto> positions = positionService.getAllPositions();
        return ResponseEntity.ok(Page.empty(pageable)); // Placeholder - would need proper pagination
    }
    
    @GetMapping("/list")
    @Operation(summary = "Get all positions as a list")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved positions")
    })
    public ResponseEntity<List<PositionDto>> getAllPositionsList() {
        List<PositionDto> positions = positionService.getAllPositions();
        return ResponseEntity.ok(positions);
    }
    
    @GetMapping("/with-parent")
    @Operation(summary = "Get all positions with parent information")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved positions with parent details")
    })
    public ResponseEntity<List<PositionDto>> getAllPositionsWithParent() {
        List<PositionDto> positions = positionService.getAllPositionsWithParent();
        return ResponseEntity.ok(positions);
    }
    
    @GetMapping("/active")
    @Operation(summary = "Get all active positions")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved active positions")
    })
    public ResponseEntity<List<PositionDto>> getAllActivePositions() {
        List<PositionDto> positions = positionService.getAllActivePositions();
        return ResponseEntity.ok(positions);
    }
    
    @GetMapping("/{id}")
    @Operation(summary = "Get position by ID")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved position"),
        @ApiResponse(responseCode = "404", description = "Position not found")
    })
    public ResponseEntity<PositionDto> getPositionById(
            @Parameter(description = "Position ID") @PathVariable UUID id) {
        PositionDto position = positionService.getPositionById(id);
        return ResponseEntity.ok(position);
    }
    
    @GetMapping("/name/{name}")
    @Operation(summary = "Get position by name")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved position"),
        @ApiResponse(responseCode = "404", description = "Position not found")
    })
    public ResponseEntity<PositionDto> getPositionByName(
            @Parameter(description = "Position name") @PathVariable String name) {
        PositionDto position = positionService.getPositionByName(name);
        return ResponseEntity.ok(position);
    }
    
    @PostMapping
    @Operation(summary = "Create new position")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Position created successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid position data")
    })
    public ResponseEntity<PositionDto> createPosition(@Valid @RequestBody PositionDto positionDto) {
        PositionDto createdPosition = positionService.createPosition(positionDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdPosition);
    }
    
    @PutMapping("/{id}")
    @Operation(summary = "Update position")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Position updated successfully"),
        @ApiResponse(responseCode = "404", description = "Position not found"),
        @ApiResponse(responseCode = "400", description = "Invalid position data")
    })
    public ResponseEntity<PositionDto> updatePosition(
            @Parameter(description = "Position ID") @PathVariable UUID id,
            @Valid @RequestBody PositionDto positionDto) {
        PositionDto updatedPosition = positionService.updatePosition(id, positionDto);
        return ResponseEntity.ok(updatedPosition);
    }
    
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete position")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Position deleted successfully"),
        @ApiResponse(responseCode = "404", description = "Position not found"),
        @ApiResponse(responseCode = "400", description = "Cannot delete position with dependencies")
    })
    public ResponseEntity<Void> deletePosition(
            @Parameter(description = "Position ID") @PathVariable UUID id) {
        positionService.deletePosition(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/search")
    @Operation(summary = "Search positions")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved search results")
    })
    public ResponseEntity<Page<PositionDto>> searchPositions(
            @Parameter(description = "Search term") @RequestParam String q,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size);
        Page<PositionDto> positions = positionService.searchPositions(q, pageable);
        return ResponseEntity.ok(positions);
    }
    
    
    @GetMapping("/root")
    @Operation(summary = "Get root positions (positions without parent)")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved root positions")
    })
    public ResponseEntity<List<PositionDto>> getRootPositions() {
        List<PositionDto> positions = positionService.getRootPositions();
        return ResponseEntity.ok(positions);
    }
    
    @GetMapping("/{parentId}/children")
    @Operation(summary = "Get child positions by parent ID")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved child positions")
    })
    public ResponseEntity<List<PositionDto>> getChildPositions(
            @Parameter(description = "Parent position ID") @PathVariable UUID parentId) {
        List<PositionDto> positions = positionService.getChildPositions(parentId);
        return ResponseEntity.ok(positions);
    }
    
    @GetMapping("/filter")
    @Operation(summary = "Get positions with filters")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved filtered positions")
    })
    public ResponseEntity<Page<PositionDto>> getPositionsWithFilters(
            @Parameter(description = "Parent position ID") @RequestParam(required = false) UUID parentId,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size);
        Page<PositionDto> positions = positionService.getPositionsWithFilters(parentId, pageable);
        return ResponseEntity.ok(positions);
    }
    
    @GetMapping("/statistics")
    @Operation(summary = "Get position statistics")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved position statistics")
    })
    public ResponseEntity<Map<String, Object>> getPositionStatistics() {
        Map<String, Object> statistics = positionService.getPositionStatistics();
        return ResponseEntity.ok(statistics);
    }
    
    @DeleteMapping("/bulk")
    @Operation(summary = "Bulk delete positions")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Positions deleted successfully"),
        @ApiResponse(responseCode = "400", description = "Cannot delete positions with dependencies")
    })
    public ResponseEntity<Void> bulkDeletePositions(@RequestBody List<UUID> positionIds) {
        positionService.bulkDeletePositions(positionIds);
        return ResponseEntity.noContent().build();
    }
    
    @PutMapping("/{id}/move")
    @Operation(summary = "Move position to different parent")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Position moved successfully"),
        @ApiResponse(responseCode = "404", description = "Position not found"),
        @ApiResponse(responseCode = "400", description = "Invalid move operation")
    })
    public ResponseEntity<PositionDto> movePosition(
            @Parameter(description = "Position ID") @PathVariable UUID id,
            @Parameter(description = "New parent position ID") @RequestParam(required = false) UUID parentId) {
        PositionDto movedPosition = positionService.movePosition(id, parentId);
        return ResponseEntity.ok(movedPosition);
    }
    
}
