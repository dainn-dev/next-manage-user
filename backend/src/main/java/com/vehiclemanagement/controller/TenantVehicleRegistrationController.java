package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.TenantVehicleRegisterRequest;
import com.vehiclemanagement.dto.TenantVehicleRegistrationDto;
import com.vehiclemanagement.service.TenantVehicleRegistrationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Closed-org plate registration into tenant management (ADR-0604).
 */
@RestController
@RequestMapping("/api/tenant-vehicle-registrations")
@PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
public class TenantVehicleRegistrationController {

    private final TenantVehicleRegistrationService registrationService;

    public TenantVehicleRegistrationController(TenantVehicleRegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @GetMapping
    public List<TenantVehicleRegistrationDto> list() {
        return registrationService.listForCurrentTenant();
    }

    @PostMapping
    public ResponseEntity<TenantVehicleRegistrationDto> register(
            @Valid @RequestBody TenantVehicleRegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(registrationService.registerByPlate(request));
    }

    @DeleteMapping("/{vehicleId}")
    public TenantVehicleRegistrationDto revoke(@PathVariable UUID vehicleId) {
        return registrationService.revoke(vehicleId);
    }
}
