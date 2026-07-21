package com.vehiclemanagement.agent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

        log.debug("Camera {} health: state={}, fps={}, lastFrame={}, error={}",
            cameraId, request.connectionState, request.fps, request.lastFrameAt, request.errorCode);
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
            log.info("Camera {} marked error due to stale frames (last frame: {})",
                health.getCameraId(), health.getLastFrameAt());
        }
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
