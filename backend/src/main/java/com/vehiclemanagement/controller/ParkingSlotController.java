package com.vehiclemanagement.controller;

import com.vehiclemanagement.parking.ParkingMapService;
import com.vehiclemanagement.parking.ParkingSlotUpsertRequest;
import com.vehiclemanagement.parking.ParkingSlotView;
import com.vehiclemanagement.parking.SlotOccupancyService;
import com.vehiclemanagement.parking.SlotOccupancyView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** HTTP contract for the Parking Map Designer's published slot layout. */
@RestController
@RequestMapping("/api/sites/{siteId}/parking-slots")
@Tag(name = "Parking Slots", description = "Versioned PostGIS parking-map polygons")
public class ParkingSlotController {
    private final ParkingMapService service;
    private final SlotOccupancyService occupancyService;

    public ParkingSlotController(ParkingMapService service, SlotOccupancyService occupancyService) {
        this.service = service;
        this.occupancyService = occupancyService;
    }

    @GetMapping
    @Operation(summary = "List the site's published parking-slot polygons")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<List<ParkingSlotView>> list(@PathVariable UUID siteId) {
        return ResponseEntity.ok(service.list(siteId));
    }

    @GetMapping("/occupancy")
    @Operation(summary = "List the current occupancy state for slots in a site or zone")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<List<SlotOccupancyView>> occupancy(
            @PathVariable UUID siteId, @RequestParam(required = false) UUID zoneId) {
        return ResponseEntity.ok(occupancyService.list(siteId, zoneId));
    }

    @PutMapping
    @Operation(summary = "Replace the site's published parking map from the designer")
    @PreAuthorize("hasRole('TENANT_ADMIN')")
    public ResponseEntity<List<ParkingSlotView>> replace(
            @PathVariable UUID siteId, @RequestBody List<ParkingSlotUpsertRequest> slots) {
        return ResponseEntity.ok(service.replace(siteId, slots));
    }
}
