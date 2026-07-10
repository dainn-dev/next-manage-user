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
 * A tenant's physical location. Created by V36; tenant_id is denormalized so the
 * Deploy 2 RLS predicate needs no join. Not mapped as a JPA field here — it is
 * stamped by the DB session default (see V39) and enforced by RLS — mirroring the
 * other tenant-scoped entities ({@link Gate}, {@link Vehicle}) which also leave
 * tenant_id unmapped.
 */
@Entity
@Table(name = "site")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Site {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false)
    @NotBlank(message = "Site name is required")
    private String name;

    @Column(name = "location")
    private String location;

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
}
