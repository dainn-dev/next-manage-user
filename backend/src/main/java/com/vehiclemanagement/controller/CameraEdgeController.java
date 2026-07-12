package com.vehiclemanagement.controller;

import com.vehiclemanagement.config.CameraKeyAuthFilter;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.service.CameraService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Camera-device endpoints authenticated by {@code X-Camera-Id} and
 * {@code X-Camera-Key}; they do not accept an operator JWT.
 */
@RestController
@RequestMapping("/api/cameras")
@Tag(name = "Camera Edge", description = "Per-camera authenticated edge operations")
public class CameraEdgeController {

    private final CameraService cameraService;

    public CameraEdgeController(CameraService cameraService) {
        this.cameraService = cameraService;
    }

    @PostMapping("/{id}/heartbeat")
    @Operation(summary = "Report a camera heartbeat",
            description = "Requires X-Camera-Id and X-Camera-Key. The header camera id must match the path.",
            security = @SecurityRequirement(name = "X-Camera-Key"))
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Heartbeat recorded"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid camera credential"),
        @ApiResponse(responseCode = "404", description = "Camera not found")
    })
    public ResponseEntity<CameraDto> heartbeat(
            @Parameter(description = "Camera ID") @PathVariable UUID id,
            jakarta.servlet.http.HttpServletRequest request) {
        Object authenticatedId = request.getAttribute(CameraKeyAuthFilter.AUTHENTICATED_CAMERA_ATTRIBUTE);
        if (!(authenticatedId instanceof UUID cameraId) || !cameraId.equals(id)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(cameraService.heartbeat(id));
    }
}
