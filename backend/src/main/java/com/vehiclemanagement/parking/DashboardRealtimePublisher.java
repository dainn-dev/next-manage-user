package com.vehiclemanagement.parking;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Publishes committed occupancy changes to the site-scoped dashboard topic. */
@Component
public class DashboardRealtimePublisher {
    private final SimpMessagingTemplate messaging;

    public DashboardRealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public void publishAfterCommit(SlotOccupancyView occupancy, OffsetDateTime occurredAt) {
        afterCommit(() -> messaging.convertAndSend(slotTopic(occupancy.siteId()), envelope(occupancy, occurredAt)));
    }

    public void publishEventAfterCommit(UUID eventId, UUID siteId, String type, OffsetDateTime occurredAt,
                                        String plate, UUID slotId, UUID zoneId, String snapshotUrl) {
        if (siteId == null || eventId == null || type == null || type.isBlank()) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", eventId);
        data.put("siteId", siteId);
        data.put("type", type);
        data.put("plate", plate);
        data.put("slotId", slotId);
        data.put("zoneId", zoneId);
        data.put("snapshotUrl", snapshotUrl);
        data.put("version", 1);
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", eventId);
        envelope.put("siteId", siteId);
        envelope.put("type", type);
        envelope.put("occurredAt", occurredAt);
        envelope.put("data", data);
        afterCommit(() -> messaging.convertAndSend(eventTopic(siteId), envelope));
    }

    public static String slotTopic(UUID siteId) {
        return "/topic/site/" + siteId + "/slots";
    }

    public static String eventTopic(UUID siteId) {
        return "/topic/site/" + siteId + "/events";
    }

    private void afterCommit(Runnable publish) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { publish.run(); }
            });
        } else {
            publish.run();
        }
    }

    private Map<String, Object> envelope(SlotOccupancyView occupancy, OffsetDateTime occurredAt) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("slotId", occupancy.slotId());
        data.put("siteId", occupancy.siteId());
        data.put("zoneId", occupancy.zoneId());
        data.put("status", occupancy.status());
        data.put("plate", occupancy.plate());
        data.put("lastSeenAt", occupancy.lastSeenAt());
        return Map.of(
                "type", "SLOT_OCCUPANCY_CHANGED",
                "siteId", occupancy.siteId(),
                "occurredAt", occurredAt,
                "data", data);
    }
}
