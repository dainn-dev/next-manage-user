package com.vehiclemanagement.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Durable idempotency ledger row for the edge ingest endpoint (docs/13 §5). The
 * {@code (camera_id, event_id)} unique constraint upgrades the in-memory
 * {@link com.vehiclemanagement.service.GateEventDeduplicator} to a cross-instance,
 * restart-surviving guard: a duplicate insert raises a unique violation and the
 * ingest API short-circuits without re-processing.
 *
 * <p>tenant_id is denormalized in the table for RLS but left unmapped here (stamped
 * by the DB session default), same convention as the other tenant-scoped entities.
 */
@Entity
@Table(name = "camera_ingest_event")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CameraIngestEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "camera_id", nullable = false)
    private UUID cameraId;

    /** Client-generated id — unique only per camera, never globally. */
    @Column(name = "event_id", nullable = false)
    private String eventId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "occurred_at")
    private LocalDateTime occurredAt;

    @Column(name = "payload", columnDefinition = "text")
    private String payload;

    @Column(name = "snapshot_path")
    private String snapshotPath;

    @Column(name = "received_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime receivedAt = LocalDateTime.now();
}
