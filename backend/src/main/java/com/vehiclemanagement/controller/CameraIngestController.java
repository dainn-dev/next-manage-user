package com.vehiclemanagement.controller;

import com.vehiclemanagement.config.CameraKeyAuthFilter;
import com.vehiclemanagement.dto.CameraIngestRequest;
import com.vehiclemanagement.dto.CameraIngestResponse;
import com.vehiclemanagement.service.CameraIngestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/** Device-facing camera event ingest, authenticated by the Stage 2 camera key. */
@RestController
@RequestMapping("/api/v1/parking-events")
@Tag(name = "Ingest", description = "Per-camera edge event ingestion")
public class CameraIngestController {

    private final CameraIngestService ingestService;

    public CameraIngestController(CameraIngestService ingestService) {
        this.ingestService = ingestService;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Ingest a camera event",
            description = "Persists an event idempotently by (camera_id, event_id). Requires X-Camera-Id and X-Camera-Key.",
            security = @SecurityRequirement(name = "X-Camera-Key"))
    @ApiResponses(value = {
            @ApiResponse(responseCode = "202", description = "Accepted or idempotent replay",
                    content = @Content(schema = @Schema(implementation = CameraIngestResponse.class))),
            @ApiResponse(responseCode = "400", description = "Malformed event"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid camera credential")
    })
    public ResponseEntity<CameraIngestResponse> ingestJson(
            @Valid @RequestBody CameraIngestRequest request,
            HttpServletRequest httpRequest) {
        return ingest(httpRequest, request, null);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Ingest a camera event with optional snapshot",
            description = "The event part is JSON; snapshot is optional and limited to 5 MB.",
            security = @SecurityRequirement(name = "X-Camera-Key"))
    public ResponseEntity<CameraIngestResponse> ingestMultipart(
            @Valid @RequestPart("event") CameraIngestRequest request,
            @RequestPart(value = "snapshot", required = false) MultipartFile snapshot,
            HttpServletRequest httpRequest) {
        return ingest(httpRequest, request, snapshot);
    }

    private ResponseEntity<CameraIngestResponse> ingest(HttpServletRequest httpRequest,
                                                         CameraIngestRequest request,
                                                         MultipartFile snapshot) {
        Object authenticatedId = httpRequest.getAttribute(CameraKeyAuthFilter.AUTHENTICATED_CAMERA_ATTRIBUTE);
        if (!(authenticatedId instanceof UUID cameraId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ingestService.ingest(cameraId, request, snapshot));
    }
}
