package com.vehiclemanagement.parking;

/** One measured image-pixel to site-local-metre correspondence. */
public record CalibrationControlPoint(double pixelX, double pixelY, double siteX, double siteY) {}

