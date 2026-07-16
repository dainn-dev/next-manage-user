package com.vehiclemanagement.parking;

import java.util.List;

public record ParkingMapValidationView(boolean valid, List<String> errors) { }
