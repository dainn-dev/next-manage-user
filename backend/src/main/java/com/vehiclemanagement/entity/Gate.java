package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A physical gate (entry/exit point) with an optional camera feed. Edge gate
 * apps register themselves and send periodic heartbeats; management endpoints
 * expose the gate list and let admins tune name / location / camera URL.
 */
@Entity
@Table(name = "gate")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, unique = true)
    @NotBlank(message = "Gate name is required")
    private String name;

    @Column(name = "location")
    private String location;

    @Column(name = "camera_rtsp_url")
    private String cameraRtspUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private GateStatus status = GateStatus.offline;

    @Column(name = "last_heartbeat_at")
    private LocalDateTime lastHeartbeatAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum GateStatus {
        online, offline, disabled
    }
}
