package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.ParkingSlotMappingRepository;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final ParkingSlotObservability observability;

    public ParkingSlotMappingService(ParkingSlotMappingRepository repository) {
        this(repository, ParkingSlotObservability.noop());
    }

    @Autowired
    public ParkingSlotMappingService(ParkingSlotMappingRepository repository,
                                      ParkingSlotObservability observability) {
        this.repository = repository;
        this.observability = observability;
    }

    @Transactional(readOnly = true)
    public ParkingSlotMappingResult map(ParkingSlotMappingRequest request) {
        List<ParkingSlotMappingCandidate> candidates = repository.findCoveringSlots(request);
        if (candidates.isEmpty()) {
            ParkingSlotMappingResult result = ParkingSlotMappingResult.noSlot();
            observability.mappingOutcome(result.status(), result.candidates().size());
            return result;
        }
        if (candidates.size() == 1) {
            ParkingSlotMappingResult result = ParkingSlotMappingResult.matched(candidates.getFirst(), candidates);
            observability.mappingOutcome(result.status(), result.candidates().size());
            return result;
        }

        if (request.currentSlotId() != null) {
            for (ParkingSlotMappingCandidate candidate : candidates) {
                if (request.currentSlotId().equals(candidate.slotId())) {
                    ParkingSlotMappingResult result = ParkingSlotMappingResult.matched(candidate, candidates);
                    observability.mappingOutcome(result.status(), result.candidates().size());
                    return result;
                }
            }
        }
        ParkingSlotMappingResult result = ParkingSlotMappingResult.ambiguous(candidates);
        observability.mappingOutcome(result.status(), result.candidates().size());
        return result;
    }
}
