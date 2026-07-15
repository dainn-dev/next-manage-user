package com.vehiclemanagement.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.dto.CameraIngestRequest;
import com.vehiclemanagement.dto.CameraIngestResponse;
import com.vehiclemanagement.exception.PayloadTooLargeException;
import com.vehiclemanagement.parking.TrackingOccupancyIntegrationService;
import com.vehiclemanagement.repository.CameraIngestEventRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.Collections;

/** Persists camera events exactly once per authenticated camera and event id. */
@Service
public class CameraIngestService {

    private final CameraIngestEventRepository repository;
    private final ObjectMapper objectMapper;
    private final SnapshotStorageService snapshotStorageService;
    private final TrackingOccupancyIntegrationService trackingOccupancyIntegrationService;
    private final long maxSnapshotBytes;
    private final MeterRegistry meterRegistry;

    public CameraIngestService(
            CameraIngestEventRepository repository,
            ObjectMapper objectMapper,
            SnapshotStorageService snapshotStorageService,
            TrackingOccupancyIntegrationService trackingOccupancyIntegrationService,
            MeterRegistry meterRegistry,
            @Value("${camera-ingest.max-snapshot-bytes:5242880}") long maxSnapshotBytes) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.snapshotStorageService = snapshotStorageService;
        this.trackingOccupancyIntegrationService = trackingOccupancyIntegrationService;
        this.meterRegistry = meterRegistry;
        this.maxSnapshotBytes = maxSnapshotBytes;
    }

    @Transactional
    public CameraIngestResponse ingest(UUID authenticatedCameraId,
                                       CameraIngestRequest request,
                                       MultipartFile snapshot) {
        return ingest(authenticatedCameraId, request,
                snapshot == null ? Collections.emptyMap() : Map.of("snapshot", snapshot));
    }

    @Transactional
    public CameraIngestResponse ingest(UUID authenticatedCameraId,
                                       CameraIngestRequest request,
                                       Map<String, MultipartFile> snapshots) {
        Timer.Sample timer = Timer.start(meterRegistry);
        if (request.getCameraId() != null && !authenticatedCameraId.equals(request.getCameraId())) {
            throw new CameraOwnershipException();
        }
        long totalSnapshotBytes = snapshots.values().stream().filter(file -> file != null && !file.isEmpty())
                .mapToLong(MultipartFile::getSize).sum();
        if (totalSnapshotBytes > maxSnapshotBytes) {
            throw new PayloadTooLargeException("Combined snapshots exceed the 5 MB limit");
        }

        String payload = serializePayload(request);
        int inserted = repository.insertIfAbsent(
                authenticatedCameraId,
                request.getEventId().toString(),
                request.getEventType().trim(),
                request.getOccurredAt(),
                payload);
        if (inserted == 0) {
            meterRegistry.counter("camera.ingest.requests", "outcome", "duplicate").increment();
            timer.stop(meterRegistry.timer("camera.ingest.latency", "outcome", "duplicate"));
            return CameraIngestResponse.accepted(request.getEventId());
        }
        String snapshotPath = null;
        for (Map.Entry<String, MultipartFile> entry : snapshots.entrySet()) {
            MultipartFile file = entry.getValue();
            if (file == null || file.isEmpty()) continue;
            String kind = "snapshot".equals(entry.getKey()) ? snapshotKind(request) : entry.getKey();
            String stored = snapshotStorageService.storeForIngest(file, authenticatedCameraId,
                    request.getEventId(), "snapshot".equals(entry.getKey()) ? null : kind);
            if (stored != null) {
                repository.insertSnapshot(authenticatedCameraId, request.getEventId().toString(), kind, stored);
                if (snapshotPath == null || "plate_crop".equals(kind)) snapshotPath = stored;
            }
        }
        if (snapshotPath != null) repository.updateSnapshotPath(authenticatedCameraId,
                request.getEventId().toString(), snapshotPath);
        trackingOccupancyIntegrationService.project(authenticatedCameraId, request.getEventId(),
                request.getEventType().trim(), request.getOccurredAt(), request.getPayload(), snapshotPath);
        repository.insertOutboxMessage(authenticatedCameraId, request.getEventId().toString(),
                "camera.ingest." + request.getEventType().trim(), outboxPayload(authenticatedCameraId, request));
        meterRegistry.counter("camera.ingest.requests", "outcome", "accepted").increment();
        timer.stop(meterRegistry.timer("camera.ingest.latency", "outcome", "accepted"));
        return CameraIngestResponse.accepted(request.getEventId());
    }

    private String outboxPayload(UUID cameraId, CameraIngestRequest request) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", request.getEventId());
        envelope.put("cameraId", cameraId);
        envelope.put("eventType", request.getEventType().trim());
        envelope.put("occurredAt", request.getOccurredAt());
        envelope.put("payload", request.getPayload());
        try {
            return objectMapper.writeValueAsString(envelope);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Malformed event payload");
        }
    }

    private String snapshotKind(CameraIngestRequest request) {
        JsonNode kind = request.getPayload() == null ? null : request.getPayload().path("snapshotUpload").path("kind");
        return kind != null && "original_frame".equals(kind.asText()) ? "original_frame" : "plate_crop";
    }

    private String serializePayload(CameraIngestRequest request) {
        try {
            JsonNode payload = request.getPayload();
            if (payload != null) {
                return objectMapper.writeValueAsString(payload);
            }
            Map<String, JsonNode> fields = new LinkedHashMap<>(request.getAdditionalFields());
            fields.remove("eventId");
            fields.remove("cameraId");
            fields.remove("eventType");
            fields.remove("type");
            fields.remove("occurredAt");
            return fields.isEmpty() ? null : objectMapper.writeValueAsString(fields);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Malformed event payload");
        }
    }

    public static class CameraOwnershipException extends RuntimeException {
    }
}
