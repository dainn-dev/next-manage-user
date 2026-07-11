package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.service.CameraService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Tenant-scoped Camera CRUD (DAI-281). All rows are confined to the caller's tenant
 * by Stage 1 RLS. Business rules enforced by the service: unique camera name within
 * a site (409), and an assigned zone must belong to the camera's site (400).
 */
@RestController
@RequestMapping("/api/cameras")
@Tag(name = "Camera Management", description = "Tenant-scoped camera registry")
public class CameraController {

    @Autowired
    private CameraService cameraService;

    @GetMapping
    @Operation(summary = "List cameras, optionally filtered by site")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved cameras")
    public ResponseEntity<List<CameraDto>> list(
            @Parameter(description = "Optional site filter") @RequestParam(required = false) UUID siteId) {
        return ResponseEntity.ok(cameraService.list(siteId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get camera by ID")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved camera"),
        @ApiResponse(responseCode = "404", description = "Camera not found")
    })
    public ResponseEntity<CameraDto> get(
            @Parameter(description = "Camera ID") @PathVariable UUID id) {
        return ResponseEntity.ok(cameraService.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a camera")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Camera created"),
        @ApiResponse(responseCode = "400", description = "Invalid camera data or zone not in the camera's site"),
        @ApiResponse(responseCode = "404", description = "Site not found"),
        @ApiResponse(responseCode = "409", description = "Camera name already in use within the site")
    })
    public ResponseEntity<CameraDto> create(
            @Parameter(description = "Camera data") @Valid @RequestBody CameraDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cameraService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a camera")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Camera updated"),
        @ApiResponse(responseCode = "400", description = "Zone not in the camera's site"),
        @ApiResponse(responseCode = "404", description = "Camera not found"),
        @ApiResponse(responseCode = "409", description = "Camera name already in use within the site")
    })
    public ResponseEntity<CameraDto> update(
            @Parameter(description = "Camera ID") @PathVariable UUID id,
            @Parameter(description = "Updated camera data") @RequestBody CameraDto request) {
        return ResponseEntity.ok(cameraService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a camera")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Camera deleted"),
        @ApiResponse(responseCode = "404", description = "Camera not found")
    })
    public ResponseEntity<Void> delete(
            @Parameter(description = "Camera ID") @PathVariable UUID id) {
        cameraService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
