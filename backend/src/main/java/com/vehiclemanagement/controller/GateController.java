package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.GateDto;
import com.vehiclemanagement.dto.GateHealthDto;
import com.vehiclemanagement.dto.GateHeartbeatRequest;
import com.vehiclemanagement.dto.GateRegisterRequest;
import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.config.EdgeTenantResolver;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.service.GateService;
import com.vehiclemanagement.service.VehicleLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gates")
@Tag(name = "Gate Management", description = "Gate registry, edge heartbeat and admin configuration")
public class GateController {

    @Autowired
    private GateService gateService;

    @Autowired
    private VehicleLogService vehicleLogService;

    @Autowired
    private EdgeTenantResolver edgeTenantResolver;

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
        boolean bound = request.getId() != null
                ? edgeTenantResolver.bindFromGateId(request.getId())
                : edgeTenantResolver.bindFromGateName(request.getName());
        try {
            return ResponseEntity.ok(gateService.register(request));
        } finally {
            if (bound) {
                TenantContext.clear();
            }
        }
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
        boolean bound = edgeTenantResolver.bindFromGateId(id);
        try {
            return ResponseEntity.ok(gateService.heartbeat(id));
        } finally {
            if (bound) {
                TenantContext.clear();
            }
        }
    }

    // ---- Management endpoints (JWT, tenant management roles) ----

    @GetMapping
    @Operation(summary = "List all gates")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponse(responseCode = "200", description = "Successfully retrieved gates")
    public ResponseEntity<List<GateDto>> list() {
        return ResponseEntity.ok(gateService.list());
    }

    @GetMapping("/health")
    @Operation(summary = "Per-gate health summary",
            description = "Aggregate health of every gate: status, last heartbeat, seconds since "
                    + "the last heartbeat and a computed online flag (heartbeat within the "
                    + "configured staleness window). Backs the health dashboard.")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponse(responseCode = "200", description = "Per-gate health list")
    public ResponseEntity<List<GateHealthDto>> health() {
        return ResponseEntity.ok(gateService.health());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get gate by ID")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
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
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
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

    @GetMapping("/{id}/recent-checks")
    @Operation(summary = "Replay recent check events for a gate",
            description = "Returns vehicle check logs for this gate created after the given "
                    + "timestamp, newest first. Backs reliable delivery: a per-gate UI that lost "
                    + "its WebSocket connection replays missed events on reconnect. When 'since' is "
                    + "omitted it defaults to the start of the current day.")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Recent checks for the gate")
    })
    public ResponseEntity<List<VehicleLogDto>> recentChecks(
            @Parameter(description = "Gate ID") @PathVariable UUID id,
            @Parameter(description = "Only return checks after this ISO-8601 timestamp (defaults to start of today)")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since) {
        return ResponseEntity.ok(vehicleLogService.getRecentChecksByGate(id, since));
    }
}
