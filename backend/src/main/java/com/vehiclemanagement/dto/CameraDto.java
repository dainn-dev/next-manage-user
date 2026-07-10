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

    @NotBlank(message = "Camera name is required")
    private String name;

    private String rtspUrl;
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
        this.name = camera.getName();
        this.rtspUrl = camera.getRtspUrl();
        this.role = camera.getRole();
        this.panelType = camera.getPanelType();
        this.status = camera.getStatus();
        this.calibrationJson = camera.getCalibrationJson();
        this.lastHeartbeatAt = camera.getLastHeartbeatAt();
        this.createdAt = camera.getCreatedAt();
        this.updatedAt = camera.getUpdatedAt();
    }
}
