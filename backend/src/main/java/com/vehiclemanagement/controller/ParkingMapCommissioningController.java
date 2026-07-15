package com.vehiclemanagement.controller;

import com.vehiclemanagement.parking.CalibrationVersionView;
import com.vehiclemanagement.parking.CreateCalibrationRequest;
import com.vehiclemanagement.parking.ParkingMapCommissioningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/sites/{siteId}/parking-map-calibrations")
@Tag(name = "Parking Map Commissioning", description = "Immutable camera calibration versions")
public class ParkingMapCommissioningController {
    private final ParkingMapCommissioningService service;

    public ParkingMapCommissioningController(ParkingMapCommissioningService service) { this.service = service; }

    @PostMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @Operation(summary = "Compute, validate, and persist an OVERVIEW camera homography")
    public ResponseEntity<CalibrationVersionView> createCalibration(
            @PathVariable UUID siteId, @RequestBody CreateCalibrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createCalibration(siteId, request));
    }
}

