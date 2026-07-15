package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

public record CalibrationVersionView(
        UUID id,
        UUID siteId,
        UUID cameraId,
        int versionNumber,
        List<Double> homography,
        double reprojectionError,
        String coordinateSpace) {
    public CalibrationVersionView { homography = List.copyOf(homography); }
}

