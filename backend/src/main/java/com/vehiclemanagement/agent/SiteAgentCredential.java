package com.vehiclemanagement.agent;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Device refresh token for agent authentication. Tokens are BCrypt-hashed and
 * never stored in plaintext. Multiple active credentials per agent support
 * rotation without downtime.
 */
@Entity
@Table(name = "site_agent_credential")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteAgentCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    /** BCrypt hash of the refresh token */
    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @Column(name = "rotated_at")
    private LocalDateTime rotatedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isActive() {
        return revokedAt == null
            && expiresAt.isAfter(LocalDateTime.now());
    }

    public boolean isExpired() {
        return expiresAt.isBefore(LocalDateTime.now());
    }
}
