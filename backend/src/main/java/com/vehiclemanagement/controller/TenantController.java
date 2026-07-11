package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.TenantDetailDto;
import com.vehiclemanagement.dto.TenantPageResponse;
import com.vehiclemanagement.dto.TenantStatisticsResponse;
import com.vehiclemanagement.dto.TenantStatusUpdateRequest;
import com.vehiclemanagement.dto.TenantUpdateRequest;
import com.vehiclemanagement.entity.TenantStatus;
import com.vehiclemanagement.service.TenantAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tenants")
@Tag(name = "Tenant Management", description = "Platform-level tenant registry")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class TenantController {

    private final TenantAdminService tenantAdminService;

    public TenantController(TenantAdminService tenantAdminService) {
        this.tenantAdminService = tenantAdminService;
    }

    @GetMapping
    @Operation(summary = "List tenants for the platform")
    public ResponseEntity<TenantPageResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(required = false) TenantStatus status,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(tenantAdminService.list(page, size, searchTerm, status, sortBy, sortDir));
    }

    @GetMapping("/summary")
    @Operation(summary = "Get tenant counts by lifecycle status")
    public ResponseEntity<TenantStatisticsResponse> summary() {
        return ResponseEntity.ok(tenantAdminService.summary());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get tenant details")
    public ResponseEntity<TenantDetailDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(tenantAdminService.get(id));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Rename a tenant")
    public ResponseEntity<TenantDetailDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody TenantUpdateRequest request) {
        return ResponseEntity.ok(tenantAdminService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update the tenant lifecycle status")
    public ResponseEntity<TenantDetailDto> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody TenantStatusUpdateRequest request) {
        return ResponseEntity.ok(tenantAdminService.updateStatus(id, request));
    }
}
