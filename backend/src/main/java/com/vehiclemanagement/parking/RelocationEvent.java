package com.vehiclemanagement.parking;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Durable event produced by one committed same-track slot transition. */
public record RelocationEvent(UUID eventId, UUID siteId, UUID oldSlotId, UUID newSlotId,
                              String trackId, String plate, OffsetDateTime occurredAt,
                              long transitionSequence) {
}
