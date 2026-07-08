package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.GateDto;
import com.vehiclemanagement.dto.GateHeartbeatRequest;
import com.vehiclemanagement.dto.GateRegisterRequest;
import com.vehiclemanagement.service.GateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gates")
@Tag(name = "Gate Management", description = "Gate registry, edge heartbeat and admin configuration")
public class GateController {

    @Autowired
    private GateService gateService;

    // ---- Edge-facing endpoints (protected by X-Gate-Key header) ----

    @PostMapping("/register")
    @Operation(summary = "Register (upsert) a gate",
            description = "Edge gate self-registration. Requires the X-Gate-Key header. "
                    + "Upserts by id when provided, otherwise by unique name.",
            security = @SecurityRequirement(name = "X-Gate-Key"))
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Gate registered; returns the gate with status online"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid X-Gate-Key header"),
        @ApiResponse(responseCode = "409", description = "Gate name already in use")
    })
    public ResponseEntity<GateDto> register(
            @Parameter(description = "Gate registration data") @Valid @RequestBody GateRegisterRequest request) {
        return ResponseEntity.ok(gateService.register(request));
    }

    @PostMapping("/{id}/heartbeat")
    @Operation(summary = "Report a gate heartbeat",
            description = "Edge liveness ping. Requires the X-Gate-Key header. "
                    + "Refreshes lastHeartbeatAt and marks the gate online.",
            security = @SecurityRequirement(name = "X-Gate-Key"))
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Heartbeat recorded"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid X-Gate-Key header"),
        @ApiResponse(responseCode = "404", description = "Gate not found")
    })
    public ResponseEntity<GateDto> heartbeat(
            @Parameter(description = "Gate ID") @PathVariable UUID id,
            @RequestBody(required = false) GateHeartbeatRequest request) {
        return ResponseEntity.ok(gateService.heartbeat(id));
    }

    // ---- Management endpoints (JWT, ADMIN only) ----

    @GetMapping
    @Operation(summary = "List all gates")
    @PreAuthorize("hasRole('ADMIN')")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved gates")
    public ResponseEntity<List<GateDto>> list() {
        return ResponseEntity.ok(gateService.list());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get gate by ID")
    @PreAuthorize("hasRole('ADMIN')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved gate"),
        @ApiResponse(responseCode = "404", description = "Gate not found")
    })
    public ResponseEntity<GateDto> get(
            @Parameter(description = "Gate ID") @PathVariable UUID id) {
        return ResponseEntity.ok(gateService.get(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update gate configuration (name / location / camera / status)")
    @PreAuthorize("hasRole('ADMIN')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Gate updated"),
        @ApiResponse(responseCode = "404", description = "Gate not found"),
        @ApiResponse(responseCode = "409", description = "Gate name already in use")
    })
    public ResponseEntity<GateDto> updateConfig(
            @Parameter(description = "Gate ID") @PathVariable UUID id,
            @Parameter(description = "Updated gate configuration") @RequestBody GateDto request) {
        return ResponseEntity.ok(gateService.updateConfig(id, request));
    }
}
