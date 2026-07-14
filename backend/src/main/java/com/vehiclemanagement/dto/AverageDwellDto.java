package com.vehiclemanagement.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AverageDwellDto(
        UUID siteId,
        OffsetDateTime from,
        OffsetDateTime to,
        double averageDwellSeconds,
        long completedSessions
) { }
