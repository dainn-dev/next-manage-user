package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Vehicle;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Authoritative site read model for plate lookup, including unregistered observed plates. */
public record PlateSearchResultDto(
        UUID id,
        String licensePlateNumber,
        UUID siteId,
        Vehicle.VehicleStatus status,
        UUID currentSlotId,
        String currentSlotCode,
        UUID currentZoneId,
        OffsetDateTime lastSeenAt,
        String lastEventType,
        String snapshotUrl) { }
