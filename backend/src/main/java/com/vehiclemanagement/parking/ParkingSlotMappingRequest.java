package com.vehiclemanagement.parking;

import java.util.UUID;

/**
 * A tracked vehicle reference point already transformed into the calibrated
 * {@code site-local-meters-v1} coordinate plane.
 *
 * @param siteId site whose currently published slots are searched
 * @param zoneId optional zone constraint from the tracking pipeline
 * @param xMeters horizontal site-local coordinate in metres
 * @param yMeters vertical site-local coordinate in metres
 * @param currentSlotId current authoritative slot, used only to retain a stable
 *                      assignment when the point lies on a shared boundary
 */
public record ParkingSlotMappingRequest(
        UUID siteId,
        UUID zoneId,
        double xMeters,
        double yMeters,
        UUID currentSlotId) {

    public ParkingSlotMappingRequest {
        if (siteId == null) {
            throw new IllegalArgumentException("siteId is required");
        }
        if (!Double.isFinite(xMeters) || !Double.isFinite(yMeters)) {
            throw new IllegalArgumentException("Mapped coordinates must be finite");
        }
    }
}
