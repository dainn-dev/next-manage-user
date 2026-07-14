package com.vehiclemanagement.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record EventTimelineItemDto(
        String id,
        UUID siteId,
        String type,
        OffsetDateTime occurredAt,
        String plate,
        UUID cameraId,
        UUID slotId,
        UUID zoneId,
        Long version,
        String snapshotUrl
) { }
