package com.vehiclemanagement.agent;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Website admin API for managing site agents.
 * Requires operator JWT authentication with appropriate roles.
 */
@RestController
@RequestMapping("/api/sites/{siteId}/agents")
@RequiredArgsConstructor
public class SiteAgentController {

    private final SiteAgentRepository agentRepository;
    private final AgentEnrollmentService enrollmentService;
    private final AgentAuthenticationService authService;
    private final CameraRuntimeHealthRepository healthRepository;

    /**
     * List all agents for a site.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
    public ResponseEntity<List<AgentSummary>> listAgents(@PathVariable UUID siteId) {
        List<SiteAgent> agents = agentRepository.findBySiteId(siteId);

        List<AgentSummary> summaries = agents.stream()
            .map(agent -> new AgentSummary(
                agent.getId(),
                agent.getName(),
                agent.getStatus(),
                agent.getVersion(),
                agent.getPlatform(),
                agent.getLastHeartbeatAt(),
                healthRepository.countByAgentId(agent.getId()),
                agent.getCreatedAt()
            ))
            .toList();

        return ResponseEntity.ok(summaries);
    }

    /**
     * Generate a new enrollment code for pairing an agent.
     */
    @PostMapping("/enrollment-codes")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
    public ResponseEntity<EnrollmentCodeResponse> createEnrollmentCode(
        @PathVariable UUID siteId,
        @RequestAttribute(value = "userId", required = false) UUID userId
    ) {
        SiteAgentEnrollmentCode code = enrollmentService.generateEnrollmentCode(siteId, userId);

        return ResponseEntity.ok(new EnrollmentCodeResponse(
            code.getCode(),
            code.getExpiresAt()
        ));
    }

    /**
     * Revoke an agent (invalidates all credentials).
     */
    @PostMapping("/{agentId}/revoke")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
    public ResponseEntity<Void> revokeAgent(@PathVariable UUID siteId, @PathVariable UUID agentId) {
        // Verify agent belongs to site
        SiteAgent agent = agentRepository.findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

        if (!agent.getSiteId().equals(siteId)) {
            return ResponseEntity.notFound().build();
        }

        authService.revokeAgent(agentId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get agent details.
     */
    @GetMapping("/{agentId}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN', 'SITE_MANAGER')")
    public ResponseEntity<AgentDetail> getAgent(@PathVariable UUID siteId, @PathVariable UUID agentId) {
        SiteAgent agent = agentRepository.findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

        if (!agent.getSiteId().equals(siteId)) {
            return ResponseEntity.notFound().build();
        }

        List<CameraRuntimeHealth> cameras = healthRepository.findByAgentId(agentId);

        AgentDetail detail = new AgentDetail(
            agent.getId(),
            agent.getName(),
            agent.getStatus(),
            agent.getVersion(),
            agent.getPlatform(),
            agent.getLastHeartbeatAt(),
            agent.getLastIp(),
            agent.getCapabilitiesJson(),
            cameras.size(),
            agent.getCreatedAt(),
            agent.getUpdatedAt(),
            agent.getRevokedAt()
        );

        return ResponseEntity.ok(detail);
    }

    // DTOs
    public record AgentSummary(
        UUID id,
        String name,
        SiteAgent.AgentStatus status,
        String version,
        String platform,
        java.time.LocalDateTime lastHeartbeatAt,
        long camerasAssigned,
        java.time.LocalDateTime createdAt
    ) {}

    public record EnrollmentCodeResponse(
        String code,
        java.time.LocalDateTime expiresAt
    ) {}

    public record AgentDetail(
        UUID id,
        String name,
        SiteAgent.AgentStatus status,
        String version,
        String platform,
        java.time.LocalDateTime lastHeartbeatAt,
        String lastIp,
        String capabilitiesJson,
        long camerasAssigned,
        java.time.LocalDateTime createdAt,
        java.time.LocalDateTime updatedAt,
        java.time.LocalDateTime revokedAt
    ) {}
}
