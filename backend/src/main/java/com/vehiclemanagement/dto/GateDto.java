package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Gate;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateDto {

    private UUID id;
    private String name;
    private String location;
    private String cameraRtspUrl;
    private Gate.GateStatus status;
    private LocalDateTime lastHeartbeatAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Constructor from entity
    public GateDto(Gate gate) {
        this.id = gate.getId();
        this.name = gate.getName();
        this.location = gate.getLocation();
        this.cameraRtspUrl = gate.getCameraRtspUrl();
        this.status = gate.getStatus();
        this.lastHeartbeatAt = gate.getLastHeartbeatAt();
        this.createdAt = gate.getCreatedAt();
        this.updatedAt = gate.getUpdatedAt();
    }
}
