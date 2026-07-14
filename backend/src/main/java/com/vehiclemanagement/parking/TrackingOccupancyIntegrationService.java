package com.vehiclemanagement.parking;

import com.fasterxml.jackson.databind.JsonNode;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.repository.CameraRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

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

    public TrackingOccupancyIntegrationService(CameraRepository cameraRepository,
                                               ParkingSlotMappingService mappingService,
                                               SlotOccupancyService occupancyService) {
        this.cameraRepository = cameraRepository;
        this.mappingService = mappingService;
        this.occupancyService = occupancyService;
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
        MappingPoint point = mappingPoint(slotObservationNode(payload));

        if (point != null) {
            ParkingSlotMappingResult mapped = mappingService.map(new ParkingSlotMappingRequest(
                    camera.getSiteId(), null, point.xMeters(), point.yMeters(),
                    current.map(SlotOccupancyView::slotId).orElse(null)));
            if (mapped.status() == ParkingSlotMappingStatus.MATCHED) {
                ParkingSlotMappingCandidate slot = mapped.match();
                occupancyService.process(new SlotOccupancyObservation(
                        slot.slotId(), camera.getSiteId(), slot.zoneId(), identity.storageKey(), plate,
                        occurredAt, current.isPresent() ? SlotOccupancyTransition.STAY : SlotOccupancyTransition.ENTER,
                        observationId, snapshotReference));
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

    /** ByteTrack IDs only have meaning within one camera stream session. */
    private record TrackerIdentity(UUID cameraId, UUID sessionId, String rawTrackId) {
        private String storageKey() {
            return cameraId + "/" + sessionId + "/" + rawTrackId;
        }
    }
}
