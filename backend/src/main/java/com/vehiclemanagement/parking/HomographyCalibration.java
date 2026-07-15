package com.vehiclemanagement.parking;

import java.util.List;

public record HomographyCalibration(
        List<Double> matrix,
        double reprojectionError,
        List<CalibrationControlPoint> controlPoints) {
    public HomographyCalibration {
        matrix = List.copyOf(matrix);
        controlPoints = List.copyOf(controlPoints);
    }
}

