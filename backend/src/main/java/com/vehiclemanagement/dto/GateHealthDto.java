package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Gate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Per-gate health snapshot (Phase 4.1). Unlike {@link GateDto}, this exposes a
 * computed {@code online} flag and {@code secondsSinceHeartbeat} so a dashboard does
 * not have to re-derive freshness from {@code lastHeartbeatAt}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateHealthDto {

    private UUID id;
    private String name;
    private String location;
    private Gate.GateStatus status;
    private LocalDateTime lastHeartbeatAt;

    /** Seconds since the last heartbeat, or {@code null} if the gate never beat. */
    private Long secondsSinceHeartbeat;

    /**
     * True when the gate is not disabled and its last heartbeat is within the
     * configured staleness window ({@code gate.heartbeat-timeout-seconds}).
     */
    private boolean online;
}
