package com.vehiclemanagement.agent;

import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.parking.CameraRealtimePublisher;
import com.vehiclemanagement.repository.CameraRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Service for tracking agent and camera health via heartbeats and frame reports.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentHealthService {

    private static final int AGENT_HEARTBEAT_TIMEOUT_SECONDS = 90;
    private static final int CAMERA_FRAME_TIMEOUT_SECONDS = 20;

    private final SiteAgentRepository agentRepository;
    private final CameraRuntimeHealthRepository healthRepository;
    private final CameraRepository cameraRepository;
    private final CameraRealtimePublisher cameraRealtimePublisher;

    /**
     * Process agent heartbeat and update status.
     */
    @Transactional
    public void recordAgentHeartbeat(UUID agentId, AgentHeartbeatRequest request) {
        SiteAgent agent = agentRepository.findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

        if (agent.getStatus() == SiteAgent.AgentStatus.revoked) {
            throw new IllegalArgumentException("Agent revoked");
        }

        agent.setLastHeartbeatAt(LocalDateTime.now());
        agent.setStatus(SiteAgent.AgentStatus.online);
        agent.setVersion(request.version);
        agent.setLastIp(request.lastIp);

        agentRepository.save(agent);

        log.debug("Agent {} heartbeat: version={}, workers={}, queueDepth={}",
            agentId, request.version, request.workers, request.queueDepth);
    }

    /**
     * Process camera health report from agent.
     */
    @Transactional
    public void recordCameraHealth(UUID agentId, UUID cameraId, CameraHealthRequest request) {
        // Verify agent owns this camera assignment
        CameraRuntimeHealth health = healthRepository.findByCameraId(cameraId)
            .orElseGet(() -> {
                CameraRuntimeHealth newHealth = new CameraRuntimeHealth();
                newHealth.setCameraId(cameraId);
                return newHealth;
            });

        health.setAgentId(agentId);
        health.setConnectionState(request.connectionState);
        health.setLastFrameAt(request.lastFrameAt);
        health.setFps(request.fps);
        health.setWidth(request.width);
        health.setHeight(request.height);
        health.setCodec(request.codec);
        health.setReconnectCount(request.reconnectCount != null ? request.reconnectCount : health.getReconnectCount());
        health.setQueueDepth(request.queueDepth != null ? request.queueDepth : health.getQueueDepth());
        health.setErrorCode(request.errorCode);
        health.setErrorMessageSafe(request.errorMessageSafe);
        health.setConfigVersion(request.configVersion);

        healthRepository.save(health);
        touchCameraFromHealth(cameraId, health);
        publishHealth(cameraId, health);

        log.debug("Camera {} health: state={}, fps={}, lastFrame={}, error={}",
            cameraId, request.connectionState, request.fps, request.lastFrameAt, request.errorCode);
    }

    /**
     * Keep the tenant camera row in sync with agent-reported runtime health so the
     * dashboard (which reads {@code camera.status}/{@code last_heartbeat_at}) reflects
     * agent ownership even when the edge camera-key heartbeat path is unused.
     */
    private void touchCameraFromHealth(UUID cameraId, CameraRuntimeHealth health) {
        Camera camera = cameraRepository.findById(cameraId).orElse(null);
        if (camera == null || camera.getStatus() == Camera.CameraStatus.disabled) {
            return;
        }
        CameraRuntimeHealth.ConnectionState state = health.getConnectionState();
        if (state == CameraRuntimeHealth.ConnectionState.streaming
                || state == CameraRuntimeHealth.ConnectionState.connecting) {
            camera.setLastHeartbeatAt(LocalDateTime.now());
            camera.setStatus(Camera.CameraStatus.online);
            cameraRepository.save(camera);
        } else if (state == CameraRuntimeHealth.ConnectionState.error
                || state == CameraRuntimeHealth.ConnectionState.stopped) {
            if (camera.getStatus() == Camera.CameraStatus.online) {
                camera.setStatus(Camera.CameraStatus.offline);
                cameraRepository.save(camera);
            }
        }
    }

    /**
     * Mark stale agents as offline (called by scheduled sweep).
     */
    @Transactional
    public void sweepStaleAgents() {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(AGENT_HEARTBEAT_TIMEOUT_SECONDS);
        var staleAgents = agentRepository.findStaleOnlineAgents(threshold);

        for (SiteAgent agent : staleAgents) {
            agent.setStatus(SiteAgent.AgentStatus.offline);
            agentRepository.save(agent);
            log.info("Agent {} marked offline (last heartbeat: {})",
                agent.getId(), agent.getLastHeartbeatAt());
        }
    }

    /**
     * Mark cameras with stale frames as offline (called by scheduled sweep).
     */
    @Transactional
    public void sweepStaleCameras() {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(CAMERA_FRAME_TIMEOUT_SECONDS);
        var staleCameras = healthRepository.findStaleStreamingCameras(threshold);

        for (CameraRuntimeHealth health : staleCameras) {
            health.setConnectionState(CameraRuntimeHealth.ConnectionState.error);
            health.setErrorCode("FRAME_TIMEOUT");
            health.setErrorMessageSafe("No frames received in " + CAMERA_FRAME_TIMEOUT_SECONDS + "s");
            healthRepository.save(health);
            publishHealth(health.getCameraId(), health);
            log.info("Camera {} marked error due to stale frames (last frame: {})",
                health.getCameraId(), health.getLastFrameAt());
        }
    }

    private void publishHealth(UUID cameraId, CameraRuntimeHealth health) {
        Camera camera = cameraRepository.findById(cameraId).orElse(null);
        if (camera == null) {
            return;
        }
        String connectionState = health.getConnectionState() == null
                ? "stopped"
                : health.getConnectionState().name();
        String status = switch (health.getConnectionState() == null
                ? CameraRuntimeHealth.ConnectionState.stopped
                : health.getConnectionState()) {
            case streaming, connecting -> "online";
            case error -> "error";
            case unassigned, assigned, stopped -> "offline";
        };
        Double fps = health.getFps() == null ? null : health.getFps().doubleValue();
        cameraRealtimePublisher.publishHealthAfterCommit(
                camera.getSiteId(),
                cameraId,
                health.getAgentId(),
                status,
                connectionState,
                health.getLastFrameAt() == null ? null : health.getLastFrameAt().atOffset(ZoneOffset.UTC),
                fps,
                health.getErrorCode(),
                java.time.OffsetDateTime.now(ZoneOffset.UTC));
    }

    // DTOs
    public record AgentHeartbeatRequest(
        String version,
        LocalDateTime startedAt,
        Integer configVersion,
        Double cpuPercent,
        Long memoryMb,
        Integer queueDepth,
        Integer workers,
        String lastIp
    ) {}

    public record CameraHealthRequest(
        CameraRuntimeHealth.ConnectionState connectionState,
        LocalDateTime lastFrameAt,
        java.math.BigDecimal fps,
        Integer width,
        Integer height,
        String codec,
        Integer reconnectCount,
        Integer queueDepth,
        String errorCode,
        String errorMessageSafe,
        Integer configVersion
    ) {}
}
