package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Tenant-scoped {@link Camera} view. The per-camera credential hash columns
 * (api_key_hash / previous_api_key_hash) are deliberately never mapped here — the
 * raw key is returned exactly once at issuance/rotation by a separate flow
 * (ADR-0602), not on the CRUD surface.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CameraDto {

    private UUID id;

    @NotNull(message = "siteId is required")
    private UUID siteId;

    /** Optional: an OVERVIEW camera may watch a whole site with no zone. */
    private UUID zoneId;

    /** Gate this camera is assigned to as a lane; null when unassigned. */
    private UUID gateId;

    @NotBlank(message = "Camera name is required")
    private String name;

    /** Source RTSP URL. Kept for legacy clients; prefer sourceUrl + sourceType. */
    private String rtspUrl;

    /** Edge capture protocol: rtsp or http (DroidCam). */
    private Camera.SourceType sourceType;

    /** Canonical edge source URL (RTSP or HTTP/MJPEG). */
    private String sourceUrl;

    private StreamDto stream;
    private String snapshotUrl;
    private Camera.CameraRole role;
    private Camera.PanelType panelType;
    private Camera.CameraStatus status;
    private String calibrationJson;
    private LocalDateTime lastHeartbeatAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public CameraDto(Camera camera) {
        this.id = camera.getId();
        this.siteId = camera.getSiteId();
        this.zoneId = camera.getZoneId();
        this.gateId = camera.getGateId();
        this.name = camera.getName();
        this.rtspUrl = camera.getRtspUrl();
        this.sourceType = camera.getSourceType() == null ? Camera.SourceType.rtsp : camera.getSourceType();
        String canonical = firstNonBlank(camera.getSourceUrl(), camera.getRtspUrl());
        this.sourceUrl = canonical;
        // Operators editing legacy RTSP-only rows still see the URL in rtspUrl.
        if (this.rtspUrl == null && this.sourceType == Camera.SourceType.rtsp) {
            this.rtspUrl = canonical;
        }
        this.stream = camera.getStreamKind() == null ? null : new StreamDto(
                camera.getStreamKind(), camera.getStreamUrl(), camera.getStreamExpiresAt());
        this.snapshotUrl = camera.getSnapshotUrl();
        this.role = camera.getRole();
        this.panelType = camera.getPanelType();
        this.status = camera.getStatus();
        this.calibrationJson = camera.getCalibrationJson();
        this.lastHeartbeatAt = camera.getLastHeartbeatAt();
        this.createdAt = camera.getCreatedAt();
        this.updatedAt = camera.getUpdatedAt();
    }

    private static String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        return null;
    }

    public record StreamDto(Camera.StreamKind kind, String url, LocalDateTime expiresAt) { }
}
