package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;
import java.time.OffsetDateTime;

public record CalibrationVersionView(
        UUID id,
        UUID siteId,
        UUID cameraId,
        int versionNumber,
        List<Double> homography,
        double reprojectionError,
        String coordinateSpace,
        UUID sourceImageId,
        String status,
        OffsetDateTime createdAt) {
    public CalibrationVersionView { homography = List.copyOf(homography); }
}
