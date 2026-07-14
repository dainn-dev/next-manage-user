package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.SlotOccupancyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Serializes slot transitions and ignores replayed, stale, or conflicting tracker events. */
@Service
public class SlotOccupancyService {
    private final SlotOccupancyRepository repository;
    private final RelocationEventStore relocationEventStore;
    private final DashboardRealtimePublisher realtimePublisher;
    public SlotOccupancyService(SlotOccupancyRepository repository, RelocationEventStore relocationEventStore,
                                DashboardRealtimePublisher realtimePublisher) {
        this.repository = repository;
        this.relocationEventStore = relocationEventStore;
        this.realtimePublisher = realtimePublisher;
    }
    @Transactional
    public SlotOccupancyView process(SlotOccupancyObservation event) {
        if (!repository.slotBelongsToSite(event.slotId(), event.siteId())) {
            throw new IllegalArgumentException("Slot does not belong to site");
        }
        List<SlotOccupancyView> lockedSlots = repository.lockTransitionSlots(event.slotId(), event.siteId(), event.trackId());
        SlotOccupancyView current = lockedSlots.stream()
                .filter(slot -> slot.slotId().equals(event.slotId()))
                .findFirst().orElse(null);
        boolean currentTrack = current != null && event.trackId().equals(current.trackId());
        boolean newer = current == null || current.lastSeenAt() == null || !event.occurredAt().isBefore(current.lastSeenAt());
        if (event.transition() == SlotOccupancyTransition.ENTER || event.transition() == SlotOccupancyTransition.STAY) {
            SlotOccupancyView oldOccupancy = lockedSlots.stream()
                    .filter(slot -> !slot.slotId().equals(event.slotId()))
                    .filter(slot -> "occupied".equals(slot.status()) && event.trackId().equals(slot.trackId()))
                    .findFirst().orElse(null);
            if (oldOccupancy != null && !oldOccupancy.slotId().equals(event.slotId())
                    && (current == null || "free".equals(current.status()))
                    && !event.occurredAt().isBefore(oldOccupancy.lastSeenAt())) {
                repository.free(oldOccupancy.slotId());
                repository.occupy(event.slotId(), event.siteId(), event.zoneId(), event.trackId(),
                        event.plate() == null || event.plate().isBlank() ? oldOccupancy.plate() : event.plate(),
                        event.occurredAt(), event.snapshotReference());
                relocationEventStore.append(oldOccupancy, event);
                SlotOccupancyView relocated = current(event.siteId(), event.zoneId(), event.slotId());
                SlotOccupancyView freed = current(event.siteId(), oldOccupancy.zoneId(), oldOccupancy.slotId());
                realtimePublisher.publishAfterCommit(freed, event.occurredAt());
                realtimePublisher.publishAfterCommit(relocated, event.occurredAt());
                return relocated;
            }
            if (current == null || "free".equals(current.status()) || (currentTrack && newer)) {
                repository.occupy(event.slotId(), event.siteId(), event.zoneId(), event.trackId(), event.plate(),
                        event.occurredAt(), event.snapshotReference());
                SlotOccupancyView occupied = current(event.siteId(), event.zoneId(), event.slotId());
                realtimePublisher.publishAfterCommit(occupied, event.occurredAt());
                return occupied;
            }
            return current;
        }
        if (currentTrack && newer) {
            repository.free(event.slotId());
            SlotOccupancyView freed = current(event.siteId(), event.zoneId(), event.slotId());
            realtimePublisher.publishAfterCommit(freed, event.occurredAt());
            return freed;
        }
        return current;
    }
    @Transactional(readOnly = true)
    public List<SlotOccupancyView> list(UUID siteId, UUID zoneId) { return repository.list(siteId, zoneId); }
    @Transactional(readOnly = true)
    public Optional<SlotOccupancyView> findOccupiedByTrack(UUID siteId, String trackId) {
        return repository.findOccupiedByTrack(siteId, trackId);
    }

    private SlotOccupancyView current(UUID siteId, UUID zoneId, UUID slotId) {
        return repository.list(siteId, zoneId).stream()
                .filter(slot -> slot.slotId().equals(slotId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Updated slot occupancy is missing"));
    }
}
