package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

public record ParkingMapUnifiedPreviewView(
        UUID siteId,
        String coordinateSpace,
        List<Feature> features) {

    public ParkingMapUnifiedPreviewView {
        features = List.copyOf(features);
    }

    public record Feature(
            UUID slotId,
            String code,
            UUID zoneId,
            String adminStatus,
            UUID cameraId,
            UUID mapVersionId,
            List<ParkingMapPoint> polygon) {
        public Feature { polygon = List.copyOf(polygon); }
    }
}
