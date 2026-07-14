package com.vehiclemanagement.parking;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Metrics and low-cardinality logs for diagnosing the parking runtime. */
@Component
public class ParkingSlotObservability {
    private static final Logger log = LoggerFactory.getLogger(ParkingSlotObservability.class);
    private static final String MAPPING_OUTCOMES = "parking.slot.mapping.outcomes";
    private static final String OCCUPANCY_OUTCOMES = "parking.slot.occupancy.outcomes";

    private final MeterRegistry registry;

    public ParkingSlotObservability(MeterRegistry registry) {
        this.registry = registry;
    }

    /** Creates an isolated registry for direct unit construction of runtime services. */
    static ParkingSlotObservability noop() {
        return new ParkingSlotObservability(new SimpleMeterRegistry());
    }

    public void mappingOutcome(ParkingSlotMappingStatus status, int candidateCount) {
        String outcome = status.name().toLowerCase();
        counter(MAPPING_OUTCOMES, outcome).increment();
        if (status == ParkingSlotMappingStatus.NO_SLOT || status == ParkingSlotMappingStatus.AMBIGUOUS) {
            log.warn("parking_slot_mapping outcome={} candidates={}", outcome, candidateCount);
        } else {
            log.debug("parking_slot_mapping outcome={} candidates={}", outcome, candidateCount);
        }
    }

    public void occupancyOutcome(String outcome, SlotOccupancyTransition transition) {
        counter(OCCUPANCY_OUTCOMES, outcome).increment();
        if ("relocation".equals(outcome)) {
            log.info("parking_slot_occupancy outcome=relocation transition={}", transition);
        } else if ("stale_track".equals(outcome) || "conflict".equals(outcome)) {
            log.warn("parking_slot_occupancy outcome={} transition={}", outcome, transition);
        } else {
            log.debug("parking_slot_occupancy outcome={} transition={}", outcome, transition);
        }
    }

    private Counter counter(String name, String outcome) {
        return Counter.builder(name)
                .description("Parking slot runtime outcomes")
                .tag("outcome", outcome)
                .register(registry);
    }
}
