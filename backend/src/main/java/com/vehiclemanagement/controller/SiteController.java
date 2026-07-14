package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.service.SiteService;
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
 * Tenant-scoped Site CRUD (DAI-281). All rows are confined to the caller's tenant
 * by Stage 1 RLS; the roles below gate who within a tenant may manage sites.
 */
@RestController
@RequestMapping("/api/sites")
@Tag(name = "Site Management", description = "Tenant-scoped site registry")
public class SiteController {

    @Autowired
    private SiteService siteService;

    @GetMapping
    @Operation(summary = "List sites visible to the caller")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved sites")
    public ResponseEntity<List<SiteDto>> list() {
        return ResponseEntity.ok(siteService.list());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get site by ID")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved site"),
        @ApiResponse(responseCode = "404", description = "Site not found")
    })
    public ResponseEntity<SiteDto> get(
            @Parameter(description = "Site ID") @PathVariable UUID id) {
        return ResponseEntity.ok(siteService.get(id));
    }

    @PostMapping
    @Operation(summary = "Create a site")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Site created"),
        @ApiResponse(responseCode = "400", description = "Invalid site data"),
        @ApiResponse(responseCode = "409", description = "Site name already in use")
    })
    public ResponseEntity<SiteDto> create(
            @Parameter(description = "Site data") @Valid @RequestBody SiteDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(siteService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a site")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Site updated"),
        @ApiResponse(responseCode = "404", description = "Site not found"),
        @ApiResponse(responseCode = "409", description = "Site name already in use")
    })
    public ResponseEntity<SiteDto> update(
            @Parameter(description = "Site ID") @PathVariable UUID id,
            @Parameter(description = "Updated site data") @RequestBody SiteDto request) {
        return ResponseEntity.ok(siteService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a site")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Site deleted"),
        @ApiResponse(responseCode = "404", description = "Site not found")
    })
    public ResponseEntity<Void> delete(
            @Parameter(description = "Site ID") @PathVariable UUID id) {
        siteService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
