package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CameraDto {

    private UUID id;
    private UUID siteId;
    private UUID zoneId;
    private String name;
    private String rtspUrl;
    private Camera.CameraRole role;
    private Camera.PanelType panelType;
    private Camera.CameraStatus status;
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
        this.lastHeartbeatAt = camera.getLastHeartbeatAt();
        this.createdAt = camera.getCreatedAt();
        this.updatedAt = camera.getUpdatedAt();
    }
}
