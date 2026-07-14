package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

/** One logical slot and its polygon supplied by the Parking Map Designer. */
public record ParkingSlotUpsertRequest(
        UUID id,
        UUID zoneId,
        String code,
        String adminStatus,
        List<ParkingMapPoint> polygon) {
    public ParkingSlotUpsertRequest {
        polygon = polygon == null ? List.of() : List.copyOf(polygon);
    }
}
