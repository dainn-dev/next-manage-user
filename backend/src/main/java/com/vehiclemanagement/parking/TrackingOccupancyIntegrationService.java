package com.vehiclemanagement.parking;

import com.fasterxml.jackson.databind.JsonNode;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.repository.CameraRepository;
import org.springframework.stereotype.Service;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Projects typed tracking/LPR ingest payloads into the authoritative slot
 * mapper. Camera credentials establish scope; payload site, slot, and storage
 * identifiers are deliberately never trusted.
 */
@Service
public class TrackingOccupancyIntegrationService {

    private final CameraRepository cameraRepository;
    private final ParkingSlotMappingService mappingService;
    private final SlotOccupancyService occupancyService;
    private final MeterRegistry meterRegistry;
    private final ConcurrentHashMap<String, Candidate> candidates = new ConcurrentHashMap<>();
    private final int enterFrames;
    private final long enterMillis;
    private final int relocationFrames;
    private final long relocationMillis;
    private final long staleSeconds;

    public TrackingOccupancyIntegrationService(CameraRepository cameraRepository,
                                               ParkingSlotMappingService mappingService,
                                               SlotOccupancyService occupancyService,
                                               MeterRegistry meterRegistry,
                                               @Value("${parking.occupancy.enter-frames:3}") int enterFrames,
                                               @Value("${parking.occupancy.enter-millis:600}") long enterMillis,
                                               @Value("${parking.occupancy.relocation-frames:5}") int relocationFrames,
                                               @Value("${parking.occupancy.relocation-millis:1000}") long relocationMillis,
                                               @Value("${parking.occupancy.stale-seconds:5}") long staleSeconds) {
        this.cameraRepository = cameraRepository;
        this.mappingService = mappingService;
        this.occupancyService = occupancyService;
        this.meterRegistry = meterRegistry;
        this.enterFrames = enterFrames;
        this.enterMillis = enterMillis;
        this.relocationFrames = relocationFrames;
        this.relocationMillis = relocationMillis;
        this.staleSeconds = staleSeconds;
    }

    /**
     * A projection failure caused by an incomplete optional tracking payload is
     * intentionally a no-op: the durable ingest ledger still records the frame,
     * and a later heartbeat/recognition can advance the same track.
     */
    public void project(UUID authenticatedCameraId, UUID observationId, String eventType,
                        OffsetDateTime occurredAt, JsonNode payload, String snapshotReference) {
        if (payload == null || !payload.isObject() || !isTrackBearingEvent(eventType)) {
            return;
        }

        TrackerIdentity identity = trackerIdentity(authenticatedCameraId, trackerNode(payload));
        if (identity == null) {
            return;
        }

        Camera camera = cameraRepository.findById(authenticatedCameraId).orElse(null);
        if (camera == null) {
            return;
        }

        Optional<SlotOccupancyView> current = occupancyService.findOccupiedByTrack(
                camera.getSiteId(), identity.storageKey());
        String plate = plate(payload);
        if (current.isEmpty() && plate != null) {
            current = occupancyService.findRecentOccupiedByPlate(camera.getSiteId(), normalizePlate(plate),
                    occurredAt.minusSeconds(30));
            if (current.isPresent()) meter("reidentified");
        }
        String authoritativeTrack = current.map(SlotOccupancyView::trackId).orElse(identity.storageKey());
        int expired = occupancyService.expireStale(camera.getSiteId(), occurredAt, authoritativeTrack, staleSeconds);
        if (expired > 0) meterRegistry.counter("parking.slot.observations", "outcome", "stale_exit")
                .increment(expired);
        MappingPoint point = mappingPoint(slotObservationNode(payload));

        if (point != null) {
            ParkingSlotMappingResult mapped = mappingService.map(new ParkingSlotMappingRequest(
                    camera.getSiteId(), null, point.xMeters(), point.yMeters(),
                    current.map(SlotOccupancyView::slotId).orElse(null)));
            if (mapped.status() == ParkingSlotMappingStatus.MATCHED) {
                ParkingSlotMappingCandidate slot = mapped.match();
                boolean relocation = current.isPresent() && !current.get().slotId().equals(slot.slotId());
                int requiredFrames = relocation ? relocationFrames : enterFrames;
                long requiredMillis = relocation ? relocationMillis : enterMillis;
                Candidate candidate = candidates.compute(authoritativeTrack, (key, previous) ->
                        previous == null || !previous.slotId().equals(slot.slotId())
                                ? new Candidate(slot.slotId(), occurredAt, occurredAt, 1)
                                : previous.advance(occurredAt));
                if (candidate.frames() < requiredFrames
                        || java.time.Duration.between(candidate.firstSeen(), candidate.lastSeen()).toMillis() < requiredMillis) {
                    meter("debounced");
                    return;
                }
                candidates.remove(authoritativeTrack);
                occupancyService.process(new SlotOccupancyObservation(
                        slot.slotId(), camera.getSiteId(), slot.zoneId(), authoritativeTrack, plate,
                        occurredAt, current.isPresent() ? SlotOccupancyTransition.STAY : SlotOccupancyTransition.ENTER,
                        observationId, snapshotReference, confidence(payload), referencePointMethod(payload)));
                meter(current.isPresent() && !current.get().slotId().equals(slot.slotId()) ? "relocation" : "enter_or_stay");
            } else {
                meter(mapped.status() == ParkingSlotMappingStatus.AMBIGUOUS ? "ambiguous" : "no_slot");
            }
            return;
        }

        // An LPR result often follows the initial detection and has no position.
        // It enriches the existing tracker assignment without making a new slot claim.
        if ("PlateRecognized".equals(eventType) && plate != null && current.isPresent()) {
            SlotOccupancyView occupied = current.get();
            occupancyService.process(new SlotOccupancyObservation(
                    occupied.slotId(), camera.getSiteId(), occupied.zoneId(), identity.storageKey(), plate,
                    occurredAt, SlotOccupancyTransition.STAY, observationId, snapshotReference));
        }
    }

    private void meter(String outcome) {
        meterRegistry.counter("parking.slot.observations", "outcome", outcome).increment();
    }

    private String normalizePlate(String value) {
        return value.toUpperCase(java.util.Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private Double confidence(JsonNode payload) {
        JsonNode node = slotObservationNode(payload).path("mappingConfidence");
        if (!node.isNumber()) node = slotObservationNode(payload).path("mapping_confidence");
        return node.isNumber() ? Math.max(0, Math.min(1, node.asDouble())) : 1.0;
    }

    private String referencePointMethod(JsonNode payload) {
        JsonNode reference = slotObservationNode(payload).path("referencePoint");
        if (!reference.isObject()) reference = slotObservationNode(payload).path("reference_point");
        String method = textField(reference, "method");
        return method == null ? "bbox_bottom_center" : method;
    }

    private boolean isTrackBearingEvent(String eventType) {
        return "VehicleDetected".equals(eventType) || "PlateRecognized".equals(eventType);
    }

    private JsonNode trackerNode(JsonNode payload) {
        JsonNode nested = payload.path("tracker");
        if (nested.isObject()) {
            return nested;
        }
        // Accept the documented flat observation form as an additive compatibility
        // profile; scope still comes exclusively from the authenticated camera.
        return payload;
    }

    private JsonNode slotObservationNode(JsonNode payload) {
        JsonNode nested = payload.path("slotObservation");
        return nested.isObject() ? nested : payload.path("slot_observation");
    }

    private TrackerIdentity trackerIdentity(UUID cameraId, JsonNode tracker) {
        String sessionValue = textField(tracker, "sessionId", "session_id");
        String trackValue = textField(tracker, "trackId", "track_id");
        if (!tracker.isObject() || sessionValue == null || trackValue == null) {
            return null;
        }
        String rawTrackId = trackValue.trim();
        if (rawTrackId.isEmpty() || rawTrackId.length() > 128) {
            return null;
        }
        try {
            UUID sessionId = UUID.fromString(sessionValue);
            return new TrackerIdentity(cameraId, sessionId, rawTrackId);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private MappingPoint mappingPoint(JsonNode slotObservation) {
        JsonNode reference = slotObservation.path("referencePoint");
        if (!reference.isObject()) {
            reference = slotObservation.path("reference_point");
        }
        JsonNode meters = reference.path("siteMeters");
        if (!meters.isObject()) {
            meters = reference.path("site_meters");
        }
        JsonNode xNode = meters.path("x");
        JsonNode yNode = meters.path("y");
        if (!xNode.isNumber() || !yNode.isNumber()) {
            xNode = slotObservation.path("xMeters");
            yNode = slotObservation.path("yMeters");
        }
        if (!xNode.isNumber() || !yNode.isNumber()) {
            xNode = slotObservation.path("x_meters");
            yNode = slotObservation.path("y_meters");
        }
        if (!xNode.isNumber() || !yNode.isNumber()) {
            return null;
        }
        double x = xNode.asDouble();
        double y = yNode.asDouble();
        return Double.isFinite(x) && Double.isFinite(y) ? new MappingPoint(x, y) : null;
    }

    private String plate(JsonNode payload) {
        JsonNode plate = payload.path("plate");
        String value = plate.isObject() ? textField(plate, "normalizedText", "normalized_text", "text") : null;
        if (value == null) {
            value = textField(payload, "licensePlate", "license_plate");
        }
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() || normalized.length() > 32 ? null : normalized;
    }

    private String textField(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode value = node.path(name);
            if (value.isTextual()) {
                return value.asText();
            }
        }
        return null;
    }

    private record MappingPoint(double xMeters, double yMeters) { }

    private record Candidate(UUID slotId, OffsetDateTime firstSeen, OffsetDateTime lastSeen, int frames) {
        private Candidate advance(OffsetDateTime observedAt) {
            if (observedAt.isBefore(lastSeen)) return this;
            return new Candidate(slotId, firstSeen, observedAt, frames + 1);
        }
    }

    /** ByteTrack IDs only have meaning within one camera stream session. */
    private record TrackerIdentity(UUID cameraId, UUID sessionId, String rawTrackId) {
        private String storageKey() {
            return cameraId + "/" + sessionId + "/" + rawTrackId;
        }
    }
}
