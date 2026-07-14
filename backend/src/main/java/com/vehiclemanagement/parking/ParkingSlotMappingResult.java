package com.vehiclemanagement.parking;

import java.util.List;

/**
 * Deterministic mapper output for occupancy processing. {@code candidates} are
 * sorted by slot code then slot ID, so ambiguous observations are reproducible
 * for audit and callers never choose a different winner by accident.
 */
public record ParkingSlotMappingResult(
        ParkingSlotMappingStatus status,
        ParkingSlotMappingCandidate match,
        List<ParkingSlotMappingCandidate> candidates) {

    public ParkingSlotMappingResult {
        candidates = List.copyOf(candidates);
        if (status == ParkingSlotMappingStatus.MATCHED && match == null) {
            throw new IllegalArgumentException("A matched result requires a slot");
        }
        if (status != ParkingSlotMappingStatus.MATCHED && match != null) {
            throw new IllegalArgumentException("Only a matched result may include a slot");
        }
    }

    public static ParkingSlotMappingResult matched(ParkingSlotMappingCandidate candidate,
                                                   List<ParkingSlotMappingCandidate> candidates) {
        return new ParkingSlotMappingResult(ParkingSlotMappingStatus.MATCHED, candidate, candidates);
    }

    public static ParkingSlotMappingResult noSlot() {
        return new ParkingSlotMappingResult(ParkingSlotMappingStatus.NO_SLOT, null, List.of());
    }

    public static ParkingSlotMappingResult ambiguous(List<ParkingSlotMappingCandidate> candidates) {
        return new ParkingSlotMappingResult(ParkingSlotMappingStatus.AMBIGUOUS, null, candidates);
    }
}
