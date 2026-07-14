package com.vehiclemanagement.parking;

import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.ParkingMapRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Transactional read/replace boundary used by the Parking Map Designer. */
@Service
public class ParkingMapService {
    private static final Set<String> SLOT_STATUSES = Set.of("enabled", "disabled", "retired");
    private final ParkingMapRepository repository;
    private final SiteRepository siteRepository;
    private final SiteAccess siteAccess;

    public ParkingMapService(ParkingMapRepository repository, SiteRepository siteRepository, SiteAccess siteAccess) {
        this.repository = repository;
        this.siteRepository = siteRepository;
        this.siteAccess = siteAccess;
    }

    @Transactional(readOnly = true)
    public List<ParkingSlotView> list(UUID siteId) {
        requireSite(siteId);
        return repository.listPublished(siteId);
    }

    /**
     * Atomically replaces the active snapshot. Existing ids keep their logical slot identity;
     * omitted ids create slots. The prior map remains a retired immutable revision.
     */
    @Transactional
    public List<ParkingSlotView> replace(UUID siteId, List<ParkingSlotUpsertRequest> slots) {
        requireSite(siteId);
        List<ParkingSlotUpsertRequest> safeSlots = slots == null ? List.of() : List.copyOf(slots);
        validateUniqueLogicalSlots(safeSlots);
        List<String> polygons = safeSlots.stream().map(this::validateAndPolygon).toList();
        validateNoOverlap(polygons);

        int version = repository.nextVersion(siteId);
        // Retire first to satisfy the partial one-published-version index, then create the
        // replacement inside this transaction so readers see either complete snapshot.
        repository.retirePublishedVersion(siteId);
        UUID mapVersion = repository.createPublishedVersion(siteId, version);
        for (int i = 0; i < safeSlots.size(); i++) {
            ParkingSlotUpsertRequest slot = safeSlots.get(i);
            UUID slotId = slot.id() == null ? UUID.randomUUID() : slot.id();
            if (slot.id() != null && !repository.slotExistsAtSite(slotId, siteId)) {
                throw new ResourceNotFoundException("Parking slot not found in this site: " + slotId);
            }
            if (slot.zoneId() != null && !repository.zoneBelongsToSite(slot.zoneId(), siteId)) {
                throw new IllegalArgumentException("Zone does not belong to this site: " + slot.zoneId());
            }
            repository.saveSlot(slotId, siteId, slot.zoneId(), normalizedCode(slot.code()), normalizedStatus(slot.adminStatus()));
            repository.saveGeometry(slotId, siteId, mapVersion, polygons.get(i));
        }
        return repository.listPublished(siteId);
    }

    private String validateAndPolygon(ParkingSlotUpsertRequest slot) {
        if (slot == null) throw new IllegalArgumentException("Slot definition is required");
        normalizedCode(slot.code());
        normalizedStatus(slot.adminStatus());
        if (slot.polygon().size() < 3) throw new IllegalArgumentException("A slot polygon needs at least three vertices");
        String polygon = toWkt(slot.polygon());
        if (!repository.isValidPolygon(polygon)) {
            throw new IllegalArgumentException("Slot polygon must be simple, valid, and have positive area");
        }
        return polygon;
    }

    private void validateNoOverlap(List<String> polygons) {
        for (int i = 0; i < polygons.size(); i++) {
            for (int j = i + 1; j < polygons.size(); j++) {
                if (repository.overlaps(polygons.get(i), polygons.get(j))) {
                    throw new IllegalArgumentException("Slot polygons must not overlap");
                }
            }
        }
    }

    private void validateUniqueLogicalSlots(List<ParkingSlotUpsertRequest> slots) {
        Set<String> codes = new HashSet<>();
        Set<UUID> ids = new HashSet<>();
        for (ParkingSlotUpsertRequest slot : slots) {
            if (slot == null) throw new IllegalArgumentException("Slot definition is required");
            if (!codes.add(normalizedCode(slot.code()).toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Slot codes must be unique within a site map");
            }
            if (slot.id() != null && !ids.add(slot.id())) {
                throw new IllegalArgumentException("A logical parking slot may appear only once in a map");
            }
        }
    }

    private String normalizedCode(String code) {
        if (code == null || code.isBlank()) throw new IllegalArgumentException("Slot code is required");
        String normalized = code.trim();
        if (normalized.length() > 20) throw new IllegalArgumentException("Slot code must be at most 20 characters");
        return normalized;
    }

    private String normalizedStatus(String status) {
        String normalized = status == null || status.isBlank() ? "enabled" : status.trim().toLowerCase(Locale.ROOT);
        if (!SLOT_STATUSES.contains(normalized)) throw new IllegalArgumentException("Invalid slot adminStatus");
        return normalized;
    }

    private String toWkt(List<ParkingMapPoint> points) {
        StringBuilder wkt = new StringBuilder("POLYGON((");
        for (ParkingMapPoint point : points) {
            if (point == null) throw new IllegalArgumentException("Polygon vertex is required");
            if (wkt.length() > 9) wkt.append(", ");
            wkt.append(point.x()).append(' ').append(point.y());
        }
        ParkingMapPoint first = points.getFirst();
        wkt.append(", ").append(first.x()).append(' ').append(first.y()).append("))");
        return wkt.toString();
    }

    private void requireSite(UUID siteId) {
        if (siteId == null || !siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        siteAccess.assertSiteAllowed(siteId);
    }
}
