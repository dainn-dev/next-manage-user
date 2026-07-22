package com.vehiclemanagement.agent;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Agent-facing REST API endpoints. Requires agent JWT authentication.
 */
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentRuntimeController {

    private final AgentPublicAuthenticationCoordinator publicAuthenticationCoordinator;
    private final AgentConfigService configService;
    private final AgentHealthService healthService;

    /**
     * Enroll a new agent with an enrollment code.
     */
    @PostMapping("/enroll")
    public ResponseEntity<EnrollmentResponse> enroll(@RequestBody AgentAuthenticationService.EnrollmentRequest request) {
        var result = publicAuthenticationCoordinator.enroll(request);

        return ResponseEntity.ok(new EnrollmentResponse(
            result.agent().getId(),
            result.agent().getSiteId(),
            result.tenantId(),
            result.accessToken(),
            result.refreshToken()
        ));
    }

    /**
     * Refresh access token.
     */
    @PostMapping("/token/refresh")
    public ResponseEntity<TokenRefreshResponse> refreshToken(
        @RequestParam UUID agentId,
        @RequestBody TokenRefreshRequest request
    ) {
        var result = publicAuthenticationCoordinator.refresh(agentId, request.refreshToken);
        return ResponseEntity.ok(new TokenRefreshResponse(result.accessToken()));
    }

    /**
     * Get desired camera configuration.
     */
    @GetMapping("/config")
    public ResponseEntity<AgentConfigService.AgentConfigResponse> getConfig(
        @AuthenticationPrincipal AgentPrincipal principal,
        @RequestParam(required = false) Integer sinceVersion
    ) {
        var config = configService.getConfig(principal.agentId(), sinceVersion);

        if (config == null) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }

        return ResponseEntity.ok()
            .header("Cache-Control", "no-store")
            .body(config);
    }

    /**
     * Agent heartbeat.
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<Void> heartbeat(
        @AuthenticationPrincipal AgentPrincipal principal,
        @RequestBody AgentHealthService.AgentHeartbeatRequest request
    ) {
        healthService.recordAgentHeartbeat(principal.agentId(), request);
        return ResponseEntity.ok().build();
    }

    /**
     * Camera health report.
     */
    @PostMapping("/cameras/{cameraId}/health")
    public ResponseEntity<Void> cameraHealth(
        @AuthenticationPrincipal AgentPrincipal principal,
        @PathVariable UUID cameraId,
        @RequestBody AgentHealthService.CameraHealthRequest request
    ) {
        healthService.recordCameraHealth(principal.agentId(), cameraId, request);
        return ResponseEntity.ok().build();
    }

    // DTOs
    public record EnrollmentResponse(
        UUID agentId,
        UUID siteId,
        UUID tenantId,
        String accessToken,
        String refreshToken
    ) {}

    public record TokenRefreshRequest(String refreshToken) {}

    public record TokenRefreshResponse(String accessToken) {}

    /**
     * Principal for agent authentication (populated by filter).
     */
    public record AgentPrincipal(
        UUID agentId,
        UUID siteId,
        UUID tenantId
    ) {}
}
