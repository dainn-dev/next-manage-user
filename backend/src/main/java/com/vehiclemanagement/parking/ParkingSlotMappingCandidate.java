package com.vehiclemanagement.parking;

import java.util.UUID;

/** A published slot polygon that covers the observed reference point. */
public record ParkingSlotMappingCandidate(
        UUID slotId,
        UUID slotGeometryId,
        UUID mapVersionId,
        UUID zoneId,
        String slotCode) {
}
