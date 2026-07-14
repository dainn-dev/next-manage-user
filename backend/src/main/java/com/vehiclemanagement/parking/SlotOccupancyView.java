package com.vehiclemanagement.parking;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SlotOccupancyView(UUID slotId, UUID siteId, UUID zoneId, String status,
                                String trackId, String plate, OffsetDateTime lastSeenAt) { }
