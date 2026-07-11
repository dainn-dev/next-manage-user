package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vehicle_access_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VehicleAccessRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Nullable: a gate-originated request for an unregistered plate has no Vehicle
    // record yet (Phase 4.4). Manual user requests still set this.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    // Nullable: a gate-originated request is raised by the system, not a human
    // requester (Phase 4.4). Manual user requests still set this.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id")
    private User requester;

    /**
     * Raw license plate as read at the gate. Populated for gate-originated requests
     * where no {@link Vehicle} exists; for manual requests the plate is derived from
     * the linked vehicle instead.
     */
    @Column(name = "license_plate")
    private String licensePlate;

    /** Origin gate for a gate-detected request (Phase 4.4); null for manual requests. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gate_id")
    private Gate gate;

    /** Branch where the request originated (copied from gate when present). */
    @Column(name = "site_id")
    private UUID siteId;

    /** Optional evidence snapshot captured at the gate (Phase 4.2 / 4.4). */
    @Column(name = "image_path")
    private String imagePath;

    /** How the request originated. Defaults to a manual USER submission. */
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false)
    @Builder.Default
    private RequestSource source = RequestSource.USER;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approver_id")
    private User approver;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AccessRequestStatus status = AccessRequestStatus.PENDING;

    @Column(name = "request_reason", nullable = false)
    private String requestReason;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum AccessRequestStatus {
        PENDING, APPROVED, REJECTED, CANCELLED
    }

    public enum RequestSource {
        USER, GATE
    }
}
