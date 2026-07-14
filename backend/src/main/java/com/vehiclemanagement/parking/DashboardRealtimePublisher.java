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
        Runnable publish = () -> messaging.convertAndSend(slotTopic(occupancy.siteId()), envelope(occupancy, occurredAt));
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { publish.run(); }
            });
        } else {
            publish.run();
        }
    }

    public static String slotTopic(UUID siteId) {
        return "/topic/site/" + siteId + "/slots";
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
