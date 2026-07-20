package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.service.SiteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Internal operating-facility lookup. A tenant has exactly one facility, enforced
 * by the database; this endpoint remains while callers are migrated away from IDs.
 */
@RestController
@RequestMapping("/api/sites")
@Tag(name = "Operating facility", description = "Single facility owned by the current tenant")
public class SiteController {

    @Autowired
    private SiteService siteService;

    @GetMapping
    @Operation(summary = "Get the current tenant operating facility")
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

}
