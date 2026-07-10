package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.CameraCreateRequest;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.service.CameraService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sites/{siteId}/cameras")
@Tag(name = "Cameras", description = "Site-scoped camera enrollment and listing")
public class CameraController {

    private final CameraService cameraService;

    public CameraController(CameraService cameraService) {
        this.cameraService = cameraService;
    }

    @GetMapping
    @Operation(summary = "List cameras for a site")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER')")
    public List<CameraDto> list(@PathVariable UUID siteId) {
        return cameraService.listBySite(siteId);
    }

    @PostMapping
    @Operation(summary = "Enroll a camera")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN', 'TENANT_ADMIN', 'SITE_MANAGER')")
    public ResponseEntity<CameraWithKeyDto> create(
            @PathVariable UUID siteId,
            @Valid @RequestBody CameraCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cameraService.create(siteId, request));
    }
}
