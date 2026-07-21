package com.vehiclemanagement.agent;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Runtime state for a camera managed by an agent. Separates runtime health
 * (connection state, frame metrics, errors) from desired configuration.
 *
 * <p>Camera is considered online when:
 * - Agent is online
 * - connection_state = 'streaming'
 * - last_frame_at is recent (within 20s)
 */
@Entity
@Table(name = "camera_runtime_health")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CameraRuntimeHealth {

    @Id
    @Column(name = "camera_id")
    private UUID cameraId;

    @Column(name = "agent_id")
    private UUID agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "connection_state", nullable = false)
    @Builder.Default
    private ConnectionState connectionState = ConnectionState.unassigned;

    @Column(name = "last_frame_at")
    private LocalDateTime lastFrameAt;

    @Column(name = "fps", precision = 5, scale = 2)
    private BigDecimal fps;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "codec")
    private String codec;

    @Column(name = "reconnect_count", nullable = false)
    @Builder.Default
    private Integer reconnectCount = 0;

    @Column(name = "queue_depth", nullable = false)
    @Builder.Default
    private Integer queueDepth = 0;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "error_message_safe", columnDefinition = "text")
    private String errorMessageSafe;

    @Column(name = "config_version")
    private Integer configVersion;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /** Runtime connection state reported by agent */
    public enum ConnectionState {
        unassigned,   // No agent assigned
        assigned,     // Agent knows about camera but worker not started
        connecting,   // Worker started, opening RTSP
        streaming,    // Receiving frames
        error,        // RTSP error (auth failed, timeout, etc)
        stopped       // Disabled or deleted, worker stopped
    }

    /**
     * Check if camera is effectively online based on frame freshness.
     * @param frameTimeoutSeconds Maximum age of last frame (typically 20s)
     */
    public boolean isOnline(int frameTimeoutSeconds) {
        if (connectionState != ConnectionState.streaming) {
            return false;
        }
        if (lastFrameAt == null) {
            return false;
        }
        return lastFrameAt.isAfter(LocalDateTime.now().minusSeconds(frameTimeoutSeconds));
    }
}
