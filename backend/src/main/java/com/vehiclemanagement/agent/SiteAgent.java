package com.vehiclemanagement.agent;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A Tauri desktop application paired with exactly one site. The agent polls
 * configuration, spawns camera workers, and reports health.
 *
 * <p>tenant_id is denormalized for RLS enforcement (same pattern as Camera).
 */
@Entity
@Table(name = "site_agent")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteAgent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    @Column(name = "name", nullable = false)
    @NotBlank(message = "Agent name is required")
    private String name;

    @Column(name = "device_fingerprint_hash", nullable = false)
    private String deviceFingerprintHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private AgentStatus status = AgentStatus.provisioning;

    @Column(name = "version")
    private String version;

    @Column(name = "platform")
    private String platform;

    @Column(name = "last_heartbeat_at")
    private LocalDateTime lastHeartbeatAt;

    @Column(name = "last_ip")
    private String lastIp;

    @Column(name = "capabilities_json", columnDefinition = "text")
    private String capabilitiesJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /** Agent lifecycle state */
    public enum AgentStatus {
        provisioning,  // Enrolled but not yet connected
        online,        // Heartbeat within timeout window
        offline,       // Heartbeat expired but not revoked
        revoked        // Credential invalidated, must re-enroll
    }
}
