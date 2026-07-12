package com.vehiclemanagement.dto;

import java.util.UUID;

/** Stable acknowledgement returned for both first delivery and idempotent replay. */
public record CameraIngestResponse(UUID eventId, String status) {

    public static CameraIngestResponse accepted(UUID eventId) {
        return new CameraIngestResponse(eventId, "accepted");
    }
}
