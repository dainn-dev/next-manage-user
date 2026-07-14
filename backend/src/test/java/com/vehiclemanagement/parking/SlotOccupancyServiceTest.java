package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.SlotOccupancyRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** DAI-304 unit coverage for transition guards and relocation observability. */
class SlotOccupancyServiceTest {
    private final SlotOccupancyRepository repository = mock(SlotOccupancyRepository.class);
    private final RelocationEventStore eventStore = mock(RelocationEventStore.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final SlotOccupancyService service = new SlotOccupancyService(repository, eventStore,
            new ParkingSlotObservability(meterRegistry));

    private final UUID siteId = UUID.randomUUID();
    private final UUID zoneId = UUID.randomUUID();
    private final UUID slotA = UUID.randomUUID();
    private final UUID slotB = UUID.randomUUID();
    private final OffsetDateTime baseTime = OffsetDateTime.parse("2026-07-14T00:00:00Z");

    @BeforeEach
    void resetRepositoryDefaults() {
        when(repository.slotBelongsToSite(any(), any())).thenReturn(true);
    }

    @Test
    void recordsEnterAndReplayOutcomesWithoutReapplyingAnOlderObservation() {
        SlotOccupancyView entered = view(slotA, "occupied", "track-1", baseTime);
        when(repository.lockTransitionSlots(slotA, siteId, "track-1"))
                .thenReturn(List.of(), List.of(entered), List.of(entered));

        assertThat(service.process(observation(slotA, "track-1", SlotOccupancyTransition.ENTER,
                baseTime))).isEqualTo(entered);
        assertThat(service.process(observation(slotA, "track-1", SlotOccupancyTransition.STAY,
                baseTime.minusSeconds(1)))).isEqualTo(entered);

        verify(repository).occupy(slotA, siteId, zoneId, "track-1", null, baseTime, null);
        assertThat(counter("enter")).isEqualTo(1);
        assertThat(counter("stale_track")).isEqualTo(1);
    }

    @Test
    void recordsConflictAndExitOutcomesForDifferentAndMatchingTrackers() {
        SlotOccupancyView occupied = view(slotA, "occupied", "track-1", baseTime);
        SlotOccupancyView free = view(slotA, "free", null, baseTime.plusSeconds(2));
        when(repository.lockTransitionSlots(slotA, siteId, "track-2")).thenReturn(List.of(occupied));
        when(repository.lockTransitionSlots(slotA, siteId, "track-1")).thenReturn(List.of(occupied), List.of(free));

        assertThat(service.process(observation(slotA, "track-2", SlotOccupancyTransition.ENTER,
                baseTime.plusSeconds(1)))).isEqualTo(occupied);
        assertThat(service.process(observation(slotA, "track-1", SlotOccupancyTransition.EXIT,
                baseTime.plusSeconds(2)))).isEqualTo(free);

        verify(repository).free(slotA);
        assertThat(counter("conflict")).isEqualTo(1);
        assertThat(counter("exit")).isEqualTo(1);
    }

    @Test
    void recordsRelocationAndPreservesThePreviousPlateWhenTheNewFrameHasNone() {
        SlotOccupancyView old = view(slotA, "occupied", "track-1", baseTime);
        SlotOccupancyView relocated = view(slotB, "occupied", "track-1", baseTime.plusSeconds(2));
        when(repository.lockTransitionSlots(slotB, siteId, "track-1"))
                .thenReturn(List.of(old), List.of(relocated));

        assertThat(service.process(new SlotOccupancyObservation(slotB, siteId, zoneId, "track-1", null,
                baseTime.plusSeconds(2), SlotOccupancyTransition.ENTER, UUID.randomUUID(), "new-frame")))
                .isEqualTo(relocated);

        verify(repository).free(slotA);
        verify(repository).occupy(slotB, siteId, zoneId, "track-1", "30A-12345",
                baseTime.plusSeconds(2), "new-frame");
        verify(eventStore).append(eq(old), argThat(observation ->
                observation.slotId().equals(slotB)
                        && observation.siteId().equals(siteId)
                        && observation.trackId().equals("track-1")
                        && observation.snapshotReference().equals("new-frame")));
        assertThat(counter("relocation")).isEqualTo(1);
    }

    private SlotOccupancyObservation observation(UUID slotId, String trackId,
                                                 SlotOccupancyTransition transition,
                                                 OffsetDateTime occurredAt) {
        return new SlotOccupancyObservation(slotId, siteId, zoneId, trackId, null, occurredAt, transition);
    }

    private SlotOccupancyView view(UUID slotId, String status, String trackId, OffsetDateTime lastSeenAt) {
        return new SlotOccupancyView(slotId, siteId, zoneId, status, trackId,
                trackId == null ? null : "30A-12345", lastSeenAt, null);
    }

    private double counter(String outcome) {
        return meterRegistry.get("parking.slot.occupancy.outcomes")
                .tag("outcome", outcome).counter().count();
    }
}
