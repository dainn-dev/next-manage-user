package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

public record ParkingMapDraftRequest(UUID sourceImageId, UUID calibrationVersionId,
        List<ParkingMapPoint> coveragePixelVertices, List<ParkingMapDraftSlotRequest> slots) { }
