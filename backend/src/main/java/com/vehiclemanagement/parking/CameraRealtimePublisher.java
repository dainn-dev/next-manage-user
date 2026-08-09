package com.vehiclemanagement.parking;

import com.vehiclemanagement.entity.Camera;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Publishes camera health/status changes to the site-scoped dashboard topic. */
@Component
public class CameraRealtimePublisher {
    private final SimpMessagingTemplate messaging;

    public CameraRealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public void publishHealthAfterCommit(Camera camera) {
        if (camera == null || camera.getSiteId() == null || camera.getId() == null) {
            return;
        }
        OffsetDateTime occurredAt = OffsetDateTime.now(ZoneOffset.UTC);
        Runnable publish = () -> messaging.convertAndSend(healthTopic(camera.getSiteId()), envelope(camera, occurredAt));
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { publish.run(); }
            });
        } else {
            publish.run();
        }
    }

    public void publishHealthAfterCommit(UUID siteId, UUID cameraId, UUID agentId, String status,
                                         String connectionState, OffsetDateTime lastFrameAt,
                                         Double fps, String errorCode, OffsetDateTime occurredAt) {
        if (siteId == null || cameraId == null) {
            return;
        }
        OffsetDateTime at = occurredAt == null ? OffsetDateTime.now(ZoneOffset.UTC) : occurredAt;
        Map<String, Object> envelope = healthEnvelope(siteId, cameraId, agentId, status, connectionState,
                lastFrameAt, fps, errorCode, at);
        Runnable publish = () -> messaging.convertAndSend(healthTopic(siteId), envelope);
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { publish.run(); }
            });
        } else {
            publish.run();
        }
    }

    public static String healthTopic(UUID siteId) {
        return "/topic/site/" + siteId + "/cameras/health";
    }

    private Map<String, Object> envelope(Camera camera, OffsetDateTime occurredAt) {
        String status = switch (camera.getStatus()) {
            case online -> "online";
            case offline, provisioned -> "offline";
            case disabled -> "error";
        };
        String connectionState = switch (camera.getStatus()) {
            case online -> "online";
            case offline, provisioned -> "stopped";
            case disabled -> "error";
        };
        OffsetDateTime lastFrameAt = camera.getLastHeartbeatAt() == null
                ? null
                : camera.getLastHeartbeatAt().atOffset(ZoneOffset.UTC);
        return healthEnvelope(camera.getSiteId(), camera.getId(), null, status, connectionState,
                lastFrameAt, null, null, occurredAt);
    }

    private Map<String, Object> healthEnvelope(UUID siteId, UUID cameraId, UUID agentId, String status,
                                               String connectionState, OffsetDateTime lastFrameAt,
                                               Double fps, String errorCode, OffsetDateTime occurredAt) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("type", "camera.health.changed");
        envelope.put("siteId", siteId.toString());
        envelope.put("cameraId", cameraId.toString());
        if (agentId != null) {
            envelope.put("agentId", agentId.toString());
        }
        envelope.put("status", status);
        envelope.put("connectionState", connectionState);
        if (lastFrameAt != null) {
            envelope.put("lastFrameAt", lastFrameAt.toString());
        }
        if (fps != null) {
            envelope.put("fps", fps);
        }
        if (errorCode != null && !errorCode.isBlank()) {
            envelope.put("errorCode", errorCode);
        }
        envelope.put("occurredAt", occurredAt.toString());
        envelope.put("version", 1);
        return envelope;
    }
}
