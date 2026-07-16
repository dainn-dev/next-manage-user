package com.vehiclemanagement.parking;

import java.util.List;
import java.util.UUID;

public record CreateCalibrationRequest(UUID cameraId, UUID sourceImageId, List<CalibrationControlPoint> controlPoints) {
    public CreateCalibrationRequest(UUID cameraId, List<CalibrationControlPoint> controlPoints) {
        this(cameraId, null, controlPoints);
    }
    public CreateCalibrationRequest {
        controlPoints = controlPoints == null ? List.of() : List.copyOf(controlPoints);
    }
}
