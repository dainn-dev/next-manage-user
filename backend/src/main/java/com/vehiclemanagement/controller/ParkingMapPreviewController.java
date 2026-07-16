package com.vehiclemanagement.controller;

import com.vehiclemanagement.parking.ParkingMapContractService;
import com.vehiclemanagement.parking.ParkingMapUnifiedPreviewView;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sites/{siteId}/maps")
public class ParkingMapPreviewController {
    private final ParkingMapContractService service;

    public ParkingMapPreviewController(ParkingMapContractService service) {
        this.service = service;
    }

    @GetMapping("/preview")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    public ParkingMapUnifiedPreviewView preview(@PathVariable UUID siteId) {
        return service.unifiedPreview(siteId);
    }
}
