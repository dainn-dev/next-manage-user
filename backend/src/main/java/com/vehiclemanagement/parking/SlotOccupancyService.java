package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.SlotOccupancyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

/** Serializes slot transitions and ignores replayed, stale, or conflicting tracker events. */
@Service
public class SlotOccupancyService {
    private final SlotOccupancyRepository repository;
    public SlotOccupancyService(SlotOccupancyRepository repository) { this.repository = repository; }
    @Transactional
    public SlotOccupancyView process(SlotOccupancyObservation event) {
        if (!repository.slotBelongsToSite(event.slotId(), event.siteId())) {
            throw new IllegalArgumentException("Slot does not belong to site");
        }
        SlotOccupancyView current = repository.lock(event.slotId());
        boolean currentTrack = current != null && event.trackId().equals(current.trackId());
        boolean newer = current == null || current.lastSeenAt() == null || !event.occurredAt().isBefore(current.lastSeenAt());
        if (event.transition() == SlotOccupancyTransition.ENTER || event.transition() == SlotOccupancyTransition.STAY) {
            if (current == null || "free".equals(current.status()) || (currentTrack && newer)) {
                repository.occupy(event.slotId(), event.siteId(), event.zoneId(), event.trackId(), event.plate(), event.occurredAt());
                return repository.lock(event.slotId());
            }
            return current;
        }
        if (currentTrack && newer) { repository.free(event.slotId()); return repository.lock(event.slotId()); }
        return current;
    }
    @Transactional(readOnly = true)
    public List<SlotOccupancyView> list(UUID siteId, UUID zoneId) { return repository.list(siteId, zoneId); }
}
