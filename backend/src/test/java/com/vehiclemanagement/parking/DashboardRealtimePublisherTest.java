package com.vehiclemanagement.parking;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.eq;

class DashboardRealtimePublisherTest {
    @Test
    void publishesSiteScopedOccupancyEnvelope() {
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        DashboardRealtimePublisher publisher = new DashboardRealtimePublisher(messaging);
        UUID siteId = UUID.randomUUID();
        UUID slotId = UUID.randomUUID();
        OffsetDateTime observedAt = OffsetDateTime.parse("2026-07-14T04:00:00Z");
        SlotOccupancyView occupancy = new SlotOccupancyView(slotId, siteId, UUID.randomUUID(),
                "occupied", "track-1", "30A12345", observedAt, null);

        publisher.publishAfterCommit(occupancy, observedAt);

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(messaging).convertAndSend(eq("/topic/site/" + siteId + "/slots"), payload.capture());
        Map<?, ?> envelope = (Map<?, ?>) payload.getValue();
        assertThat(envelope.get("type")).isEqualTo("SLOT_OCCUPANCY_CHANGED");
        assertThat(envelope.get("siteId")).isEqualTo(siteId);
        assertThat(((Map<?, ?>) envelope.get("data")).get("slotId")).isEqualTo(slotId);
        assertThat(((Map<?, ?>) envelope.get("data")).get("status")).isEqualTo("occupied");
    }
}
