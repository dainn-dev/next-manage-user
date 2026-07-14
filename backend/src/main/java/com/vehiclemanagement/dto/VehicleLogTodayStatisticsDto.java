package com.vehiclemanagement.dto;

public record VehicleLogTodayStatisticsDto(
        long entryCount,
        long exitCount,
        long uniqueVehicles) {
}
