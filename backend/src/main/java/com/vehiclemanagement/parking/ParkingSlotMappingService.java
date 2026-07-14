package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.ParkingSlotMappingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Authoritative backend point-in-polygon mapper for occupancy processing.
 *
 * <p>PostGIS {@code ST_Covers} intentionally includes polygon boundaries. A
 * boundary shared by two published slots remains stable if the caller provides
 * the identity's current slot; otherwise the service returns an explicit
 * ambiguous result and leaves a later occupancy state machine to hold state.
 * This prevents arbitrary slot flips near map boundaries.</p>
 */
@Service
public class ParkingSlotMappingService {

    private final ParkingSlotMappingRepository repository;

    public ParkingSlotMappingService(ParkingSlotMappingRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public ParkingSlotMappingResult map(ParkingSlotMappingRequest request) {
        List<ParkingSlotMappingCandidate> candidates = repository.findCoveringSlots(request);
        if (candidates.isEmpty()) {
            return ParkingSlotMappingResult.noSlot();
        }
        if (candidates.size() == 1) {
            return ParkingSlotMappingResult.matched(candidates.getFirst(), candidates);
        }

        if (request.currentSlotId() != null) {
            for (ParkingSlotMappingCandidate candidate : candidates) {
                if (request.currentSlotId().equals(candidate.slotId())) {
                    return ParkingSlotMappingResult.matched(candidate, candidates);
                }
            }
        }
        return ParkingSlotMappingResult.ambiguous(candidates);
    }
}
