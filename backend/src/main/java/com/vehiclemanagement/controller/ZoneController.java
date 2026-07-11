package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.ZoneDto;
import com.vehiclemanagement.service.ZoneService;
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
 * Tenant-scoped Zone CRUD (DAI-281). Zones belong to a site; both are confined to
 * the caller's tenant by Stage 1 RLS.
 */
@RestController
@RequestMapping("/api/zones")
@Tag(name = "Zone Management", description = "Tenant-scoped zone registry (sub-areas of a site)")
public class ZoneController {

    @Autowired
    private ZoneService zoneService;

    @GetMapping
    @Operation(summary = "List zones, optionally filtered by site")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved zones")
    public ResponseEntity<List<ZoneDto>> list(
            @Parameter(description = "Optional site filter") @RequestParam(required = false) UUID siteId) {
        return ResponseEntity.ok(zoneService.list(siteId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get zone by ID")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved zone"),
        @ApiResponse(responseCode = "404", description = "Zone not found")
    })
    public ResponseEntity<ZoneDto> get(
            @Parameter(description = "Zone ID") @PathVariable UUID id) {
        return ResponseEntity.ok(zoneService.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a zone")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Zone created"),
        @ApiResponse(responseCode = "400", description = "Invalid zone data"),
        @ApiResponse(responseCode = "404", description = "Site not found"),
        @ApiResponse(responseCode = "409", description = "Zone name already in use within the site")
    })
    public ResponseEntity<ZoneDto> create(
            @Parameter(description = "Zone data") @Valid @RequestBody ZoneDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(zoneService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a zone")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Zone updated"),
        @ApiResponse(responseCode = "404", description = "Zone not found"),
        @ApiResponse(responseCode = "409", description = "Zone name already in use within the site")
    })
    public ResponseEntity<ZoneDto> update(
            @Parameter(description = "Zone ID") @PathVariable UUID id,
            @Parameter(description = "Updated zone data") @RequestBody ZoneDto request) {
        return ResponseEntity.ok(zoneService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a zone")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Zone deleted"),
        @ApiResponse(responseCode = "404", description = "Zone not found")
    })
    public ResponseEntity<Void> delete(
            @Parameter(description = "Zone ID") @PathVariable UUID id) {
        zoneService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
