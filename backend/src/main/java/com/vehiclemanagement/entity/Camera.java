package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A first-class, site-scoped camera (docs/07_Camera_Management §3.1). Replaces the
 * inline {@code cameraRtspUrl} string on {@link Gate} with an entity that owns its
 * own lifecycle, per-camera credential (ADR-0602), health signal and calibration.
 *
 * <p>tenant_id is denormalized in the table for the RLS predicate but left unmapped
 * here (stamped by the DB session default, enforced by RLS) — same convention as
 * {@link Gate}/{@link Vehicle}. The credential hash columns are never exposed on the
 * DTO; the raw key is returned exactly once at issuance/rotation.
 */
@Entity
@Table(name = "camera")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Camera {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    @Column(name = "zone_id")
    private UUID zoneId;

    @Column(name = "name", nullable = false)
    @NotBlank(message = "Camera name is required")
    private String name;

    @Column(name = "rtsp_url")
    private String rtspUrl;

    /**
     * Edge capture protocol. {@link SourceType#http} covers DroidCam / IP Webcam MJPEG.
     * {@link #sourceUrl} is the canonical location delivered to site agents.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    @Builder.Default
    private SourceType sourceType = SourceType.rtsp;

    @Column(name = "source_url")
    private String sourceUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "stream_kind")
    private StreamKind streamKind;

    @Column(name = "stream_url")
    private String streamUrl;

    @Column(name = "stream_expires_at")
    private LocalDateTime streamExpiresAt;

    @Column(name = "snapshot_url")
    private String snapshotUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    @Builder.Default
    private CameraRole role = CameraRole.ANPR_GATE;

    @Enumerated(EnumType.STRING)
    @Column(name = "panel_type")
    private PanelType panelType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private CameraStatus status = CameraStatus.provisioned;

    /** BCrypt hash of the active per-camera API key. Never returned to clients. */
    @Column(name = "api_key_hash")
    private String apiKeyHash;

    /** BCrypt hash of the superseded key, still valid during the rotation grace window. */
    @Column(name = "previous_api_key_hash")
    private String previousApiKeyHash;

    /** When the superseded key stops being accepted. Null when no rotation is in flight. */
    @Column(name = "previous_api_key_expires_at")
    private LocalDateTime previousApiKeyExpiresAt;

    @Column(name = "calibration_json", columnDefinition = "text")
    private String calibrationJson;

    @Column(name = "last_heartbeat_at")
    private LocalDateTime lastHeartbeatAt;

    @Column(name = "config_version", nullable = false)
    @Builder.Default
    private Integer configVersion = 1;

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

    /** Camera role — drives which pipelines subscribe to this camera's frames. */
    public enum CameraRole {
        ANPR_GATE, OVERVIEW
    }

    /** Physical panel semantics; meaningful for ANPR_GATE cameras only. */
    public enum PanelType {
        entry, exit
    }

    /** Lifecycle: see docs/07 §9.2 state diagram. */
    public enum CameraStatus {
        provisioned, online, offline, disabled
    }

    public enum StreamKind {
        HLS, WEBRTC, MJPEG, MP4
    }

    /** Edge/agent capture source kind. */
    public enum SourceType {
        rtsp,
        http
    }
}
