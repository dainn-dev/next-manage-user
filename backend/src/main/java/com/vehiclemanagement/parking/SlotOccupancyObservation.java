package com.vehiclemanagement.parking;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Idempotent state-machine input; timestamps order repeated/out-of-order detections. */
public record SlotOccupancyObservation(UUID slotId, UUID siteId, UUID zoneId, String trackId,
                                      String plate, OffsetDateTime occurredAt,
                                      SlotOccupancyTransition transition,
                                      UUID observationId, String snapshotReference,
                                      Double assignmentConfidence, String referencePointMethod) {
    public SlotOccupancyObservation(UUID slotId, UUID siteId, UUID zoneId, String trackId,
                                    String plate, OffsetDateTime occurredAt,
                                    SlotOccupancyTransition transition) {
        this(slotId, siteId, zoneId, trackId, plate, occurredAt, transition, null, null, null, null);
    }
    public SlotOccupancyObservation(UUID slotId, UUID siteId, UUID zoneId, String trackId,
                                    String plate, OffsetDateTime occurredAt,
                                    SlotOccupancyTransition transition, UUID observationId,
                                    String snapshotReference) {
        this(slotId, siteId, zoneId, trackId, plate, occurredAt, transition, observationId,
                snapshotReference, null, null);
    }
    public SlotOccupancyObservation {
        if (slotId == null || siteId == null || trackId == null || trackId.isBlank()
                || occurredAt == null || transition == null) {
            throw new IllegalArgumentException("slotId, siteId, trackId, occurredAt, and transition are required");
        }
    }
}
