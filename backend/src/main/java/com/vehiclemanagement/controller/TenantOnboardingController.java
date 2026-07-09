package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.TenantOnboardingRequest;
import com.vehiclemanagement.dto.TenantOnboardingResponse;
import com.vehiclemanagement.service.TenantOnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tenants")
@Tag(name = "Tenant Onboarding", description = "APIs for tenant onboarding")
public class TenantOnboardingController {

    private final TenantOnboardingService onboardingService;

    public TenantOnboardingController(TenantOnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @PostMapping
    @Operation(summary = "Create a tenant", description = "Create a tenant, initial site, first tenant admin, and scoped JWT")
    public ResponseEntity<TenantOnboardingResponse> onboardTenant(
            @Valid @RequestBody TenantOnboardingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(onboardingService.onboardTenant(request));
    }
}
