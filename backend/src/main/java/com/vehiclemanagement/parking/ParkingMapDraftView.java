package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

public record ParkingMapDraftView(UUID id, UUID siteId, UUID cameraId, int versionNumber,
        String status, int lockVersion, UUID sourceImageId, UUID calibrationVersionId,
        List<ParkingMapPoint> coveragePixelVertices, List<ParkingMapDraftSlotRequest> slots) { }
