package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.ParkingFloorDto;
import com.vehiclemanagement.service.ParkingFloorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/parking-floors")
public class ParkingFloorController {
    private final ParkingFloorService floorService;

    public ParkingFloorController(ParkingFloorService floorService) {
        this.floorService = floorService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    public ResponseEntity<List<ParkingFloorDto>> list(@RequestParam UUID siteId) {
        return ResponseEntity.ok(floorService.list(siteId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')")
    public ResponseEntity<ParkingFloorDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(floorService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<ParkingFloorDto> create(@Valid @RequestBody ParkingFloorDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(floorService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<ParkingFloorDto> update(@PathVariable UUID id, @RequestBody ParkingFloorDto request) {
        return ResponseEntity.ok(floorService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        floorService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
