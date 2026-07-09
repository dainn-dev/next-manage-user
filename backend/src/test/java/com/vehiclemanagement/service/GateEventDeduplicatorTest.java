package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleCheckResponse;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Unit tests for the Phase 4.3 best-effort idempotency guard. */
class GateEventDeduplicatorTest {

    private VehicleCheckResponse resp(String plate) {
        return new VehicleCheckResponse(true, "OK", plate, "entry");
    }

    @Test
    void blankOrNullEventIdIsNeverDeduplicated() {
        GateEventDeduplicator dedup = new GateEventDeduplicator();
        assertTrue(dedup.cachedResponse(null).isEmpty());
        assertTrue(dedup.cachedResponse("").isEmpty());
        assertTrue(dedup.cachedResponse("   ").isEmpty());

        // Recording under a blank id must be a no-op, not a shared bucket.
        dedup.record(null, resp("X"));
        assertTrue(dedup.cachedResponse(null).isEmpty());
    }

    @Test
    void retryWithSameEventIdReturnsTheOriginalResponse() {
        GateEventDeduplicator dedup = new GateEventDeduplicator();
        String id = "evt-1";

        assertTrue(dedup.cachedResponse(id).isEmpty(), "unseen id is not cached");

        VehicleCheckResponse first = resp("51A-111.11");
        dedup.record(id, first);

        Optional<VehicleCheckResponse> cached = dedup.cachedResponse(id);
        assertTrue(cached.isPresent(), "a seen id is cached");
        assertSame(first, cached.get(), "the ORIGINAL response is returned on retry");
    }

    @Test
    void distinctEventIdsAreIndependent() {
        GateEventDeduplicator dedup = new GateEventDeduplicator();
        dedup.record("a", resp("AAA"));
        dedup.record("b", resp("BBB"));
        assertEquals("AAA", dedup.cachedResponse("a").get().getLicensePlateNumber());
        assertEquals("BBB", dedup.cachedResponse("b").get().getLicensePlateNumber());
    }

    @Test
    void expiredEntriesAreForgotten() {
        // now() advances past the TTL between record and lookup.
        final long[] clock = {1_000_000L};
        GateEventDeduplicator dedup = new GateEventDeduplicator() {
            @Override
            long now() {
                return clock[0];
            }
        };
        dedup.record("evt", resp("Z"));
        assertTrue(dedup.cachedResponse("evt").isPresent(), "cached within TTL");

        clock[0] += 11 * 60 * 1000L; // 11 minutes > 10-minute TTL
        assertFalse(dedup.cachedResponse("evt").isPresent(), "forgotten after TTL");
    }
}
