package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

/** Read model used by the Parking Map Designer to redraw a published map. */
public record ParkingSlotView(
        UUID id,
        UUID zoneId,
        String code,
        String adminStatus,
        List<ParkingMapPoint> polygon) {
    public ParkingSlotView {
        polygon = List.copyOf(polygon);
    }
}
