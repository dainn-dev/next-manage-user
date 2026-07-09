package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleCheckResponse;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Lightweight, best-effort idempotency guard for gate check-vehicle events
 * (Phase 4.3).
 *
 * <p>The edge tags every confirmed detection with a client-generated {@code
 * eventId} and, because it re-sends events from a store-and-forward queue when
 * the backend was unreachable, the <em>same</em> event id can legitimately
 * arrive more than once (e.g. the backend processed a request but the HTTP
 * response was lost in transit). This component remembers recently-seen event
 * ids and the response that was produced for them, so a retry short-circuits and
 * returns the original answer instead of mutating vehicle state and creating a
 * second {@link com.vehiclemanagement.entity.VehicleLog}.</p>
 *
 * <p>Scope is deliberately minimal: an in-memory, bounded, TTL-expiring cache.
 * It is not shared across instances and does not survive a restart — matching
 * the "best-effort" bar in the task. It touches none of the decision logic; the
 * controller simply consults it before delegating and records the result after.</p>
 */
@Component
public class GateEventDeduplicator {

    /** Max distinct event ids remembered before the oldest are evicted. */
    private static final int MAX_ENTRIES = 20_000;

    /** How long a remembered response is considered valid for a retry. */
    private static final long TTL_MILLIS = 10 * 60 * 1000L; // 10 minutes

    private static final class CachedEntry {
        final VehicleCheckResponse response;
        final long expiresAt;

        CachedEntry(VehicleCheckResponse response, long expiresAt) {
            this.response = response;
            this.expiresAt = expiresAt;
        }
    }

    // Access-ordered LRU: eldest entry is evicted once capacity is exceeded.
    private final Map<String, CachedEntry> seen =
            new LinkedHashMap<String, CachedEntry>(1024, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CachedEntry> eldest) {
                    return size() > MAX_ENTRIES;
                }
            };

    /**
     * Return the response previously produced for {@code eventId}, if it was seen
     * within the TTL. A blank/{@code null} event id is never deduplicated.
     */
    public synchronized Optional<VehicleCheckResponse> cachedResponse(String eventId) {
        if (eventId == null || eventId.isBlank()) {
            return Optional.empty();
        }
        CachedEntry entry = seen.get(eventId);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.expiresAt < now()) {
            seen.remove(eventId);
            return Optional.empty();
        }
        return Optional.of(entry.response);
    }

    /** Remember the response produced for {@code eventId}. No-op if id is blank. */
    public synchronized void record(String eventId, VehicleCheckResponse response) {
        if (eventId == null || eventId.isBlank() || response == null) {
            return;
        }
        seen.put(eventId, new CachedEntry(response, now() + TTL_MILLIS));
    }

    // Overridable seam kept package-private for tests; wall-clock in production.
    long now() {
        return System.currentTimeMillis();
    }
}
