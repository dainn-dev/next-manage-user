package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.TenantSettingsResponse;
import com.vehiclemanagement.dto.TenantSettingsUpdateRequest;
import com.vehiclemanagement.service.TenantSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tenant")
@Tag(name = "Tenant Settings", description = "Own-organization profile for TENANT_ADMIN")
@PreAuthorize("hasRole('TENANT_ADMIN')")
public class TenantSettingsController {

    private final TenantSettingsService tenantSettingsService;

    public TenantSettingsController(TenantSettingsService tenantSettingsService) {
        this.tenantSettingsService = tenantSettingsService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current organization profile")
    public ResponseEntity<TenantSettingsResponse> getMe() {
        return ResponseEntity.ok(tenantSettingsService.getMe());
    }

    @PatchMapping("/me")
    @Operation(summary = "Update current organization profile (name, management model, area count)")
    public ResponseEntity<TenantSettingsResponse> updateMe(
            @Valid @RequestBody TenantSettingsUpdateRequest request) {
        return ResponseEntity.ok(tenantSettingsService.updateMe(request));
    }
}
