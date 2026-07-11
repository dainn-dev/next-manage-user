package com.vehiclemanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * Links a platform {@link User.Role#MEMBER} to a tenant that may manage them
 * (school / boarding house). See ADR-0603.
 */
@Entity
@Table(name = "member_affiliation")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(MemberAffiliation.MemberAffiliationId.class)
public class MemberAffiliation {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Id
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public enum Status {
        ACTIVE,
        INVITED,
        REVOKED
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberAffiliationId implements Serializable {
        private UUID userId;
        private UUID tenantId;
    }
}
