package com.vehiclemanagement.parking;

/** A vertex in the calibrated site-local metre plane (SRID 0). */
public record ParkingMapPoint(double x, double y) {
    public ParkingMapPoint {
        if (!Double.isFinite(x) || !Double.isFinite(y)) {
            throw new IllegalArgumentException("Polygon coordinates must be finite");
        }
    }
}
