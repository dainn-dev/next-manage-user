package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

public record ParkingMapDraftSlotRequest(UUID slotId, UUID zoneId, String code,
        String adminStatus, List<ParkingMapPoint> pixelVertices) { }
