package com.vehiclemanagement.agent;

import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.repository.CameraRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service for delivering desired camera configuration to agents.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentConfigService {

    private final SiteAgentRepository agentRepository;
    private final CameraRepository cameraRepository;

    /**
     * Get desired configuration for an agent.
     * @param agentId Agent requesting config
     * @param sinceVersion Last known config version (optional)
     * @return Configuration response
     */
    @Transactional(readOnly = true)
    public AgentConfigResponse getConfig(UUID agentId, Integer sinceVersion) {
        SiteAgent agent = agentRepository.findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

        if (agent.getStatus() == SiteAgent.AgentStatus.revoked) {
            throw new IllegalArgumentException("Agent revoked");
        }

        // Get all cameras for agent's site
        List<Camera> cameras = cameraRepository.findBySiteId(agent.getSiteId());

        // Calculate current config version (max of all camera config versions)
        int currentVersion = cameras.stream()
            .mapToInt(Camera::getConfigVersion)
            .max()
            .orElse(1);

        // Return 304 if no changes
        if (sinceVersion != null && sinceVersion >= currentVersion) {
            return null; // Controller will return 304 Not Modified
        }

        // Build camera config list
        List<CameraConfig> cameraConfigs = new ArrayList<>();
        for (Camera camera : cameras) {
            // Only include enabled cameras
            if (camera.getStatus() == Camera.CameraStatus.disabled) {
                continue;
            }

            CameraConfig config = new CameraConfig(
                camera.getId(),
                camera.getName(),
                camera.getRole(),
                camera.getPanelType(),
                true, // enabled
                resolveSource(camera),
                "lpr-default-v1", // pipeline profile
                camera.getConfigVersion()
            );
            if (config.source() == null || config.source().url() == null || config.source().url().isBlank()) {
                log.warn("Skipping camera {} — no usable source URL for agent {}", camera.getId(), agentId);
                continue;
            }
            cameraConfigs.add(config);
        }

        log.info("Delivering config version {} to agent {} ({} cameras)",
            currentVersion, agentId, cameraConfigs.size());

        return new AgentConfigResponse(
            currentVersion,
            agent.getSiteId(),
            java.time.LocalDateTime.now(),
            cameraConfigs
        );
    }

    static CameraSource resolveSource(Camera camera) {
        Camera.SourceType type = camera.getSourceType() == null
                ? Camera.SourceType.rtsp
                : camera.getSourceType();
        String url = camera.getSourceUrl();
        if (url == null || url.isBlank()) {
            url = camera.getRtspUrl();
        }
        if (url == null || url.isBlank()) {
            return null;
        }
        // Infer http when operators stored an HTTP URL under legacy rtsp_url only.
        if (type == Camera.SourceType.rtsp
                && (url.regionMatches(true, 0, "http://", 0, 7)
                || url.regionMatches(true, 0, "https://", 0, 8))) {
            type = Camera.SourceType.http;
        }
        return new CameraSource(type.name(), url, null, null);
    }

    // DTOs
    public record AgentConfigResponse(
        int version,
        UUID siteId,
        java.time.LocalDateTime generatedAt,
        List<CameraConfig> cameras
    ) {}

    public record CameraConfig(
        UUID id,
        String name,
        Camera.CameraRole role,
        Camera.PanelType panelType,
        boolean enabled,
        CameraSource source,
        String pipelineProfile,
        int revision
    ) {}

    public record CameraSource(
        String type,
        String url,
        String username,
        String password
    ) {}
}
