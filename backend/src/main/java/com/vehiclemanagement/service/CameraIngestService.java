package com.vehiclemanagement.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.dto.CameraIngestRequest;
import com.vehiclemanagement.dto.CameraIngestResponse;
import com.vehiclemanagement.exception.PayloadTooLargeException;
import com.vehiclemanagement.repository.CameraIngestEventRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Persists camera events exactly once per authenticated camera and event id. */
@Service
public class CameraIngestService {

    private final CameraIngestEventRepository repository;
    private final ObjectMapper objectMapper;
    private final SnapshotStorageService snapshotStorageService;
    private final long maxSnapshotBytes;

    public CameraIngestService(
            CameraIngestEventRepository repository,
            ObjectMapper objectMapper,
            SnapshotStorageService snapshotStorageService,
            @Value("${camera-ingest.max-snapshot-bytes:5242880}") long maxSnapshotBytes) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.snapshotStorageService = snapshotStorageService;
        this.maxSnapshotBytes = maxSnapshotBytes;
    }

    @Transactional
    public CameraIngestResponse ingest(UUID authenticatedCameraId,
                                       CameraIngestRequest request,
                                       MultipartFile snapshot) {
        if (request.getCameraId() != null && !authenticatedCameraId.equals(request.getCameraId())) {
            throw new CameraOwnershipException();
        }
        if (snapshot != null && !snapshot.isEmpty() && snapshot.getSize() > maxSnapshotBytes) {
            throw new PayloadTooLargeException("Snapshot exceeds the 5 MB limit");
        }

        String payload = serializePayload(request);
        int inserted = repository.insertIfAbsent(
                authenticatedCameraId,
                request.getEventId().toString(),
                request.getEventType().trim(),
                request.getOccurredAt(),
                payload);
        if (inserted == 0) {
            return CameraIngestResponse.accepted(request.getEventId());
        }

        if (snapshot != null && !snapshot.isEmpty()) {
            String snapshotPath = snapshotStorageService.storeForIngest(snapshot, authenticatedCameraId,
                    request.getEventId());
            if (snapshotPath != null) {
                repository.updateSnapshotPath(authenticatedCameraId,
                        request.getEventId().toString(), snapshotPath);
            }
        }
        return CameraIngestResponse.accepted(request.getEventId());
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
