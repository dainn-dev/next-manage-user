package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Gate;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateDto {

    private UUID id;
    private UUID siteId;
    private String name;
    private String location;
    private Gate.GateType gateType;
    private String cameraRtspUrl;
    private Gate.GateStatus status;
    private LocalDateTime lastHeartbeatAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Lanes currently attached to this gate (one camera each). */
    @Builder.Default
    private List<GateLaneDto> lanes = new ArrayList<>();

    /**
     * Write-only: ordered camera ids for lane sync on update. Null means leave
     * existing lane assignments unchanged; empty list clears all lanes.
     */
    private List<UUID> cameraIds;

    // Constructor from entity (lanes filled by service)
    public GateDto(Gate gate) {
        this.id = gate.getId();
        this.siteId = gate.getSiteId();
        this.name = gate.getName();
        this.location = gate.getLocation();
        this.gateType = gate.getGateType();
        this.cameraRtspUrl = gate.getCameraRtspUrl();
        this.status = gate.getStatus();
        this.lastHeartbeatAt = gate.getLastHeartbeatAt();
        this.createdAt = gate.getCreatedAt();
        this.updatedAt = gate.getUpdatedAt();
        this.lanes = new ArrayList<>();
    }
}
