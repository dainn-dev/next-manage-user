package com.vehiclemanagement.agent;

import com.vehiclemanagement.config.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Establishes tenant context for public enroll/refresh requests, then delegates
 * to the normal RLS-scoped authentication service in a separate transaction.
 */
@Service
@RequiredArgsConstructor
public class AgentPublicAuthenticationCoordinator {

    private final AgentTenantResolver tenantResolver;
    private final AgentAuthenticationService authenticationService;

    public AgentAuthenticationService.EnrollmentResult enroll(
            AgentAuthenticationService.EnrollmentRequest request) {
        String code = normalizeEnrollmentCode(request.enrollmentCode());
        UUID tenantId = tenantResolver.resolveByEnrollmentCode(code)
            .orElseThrow(() -> new IllegalArgumentException("Invalid enrollment code"));

        var normalizedRequest = new AgentAuthenticationService.EnrollmentRequest(
            code,
            request.name(),
            request.deviceFingerprint(),
            request.version(),
            request.platform());

        return withTenant(tenantId, () -> authenticationService.enrollAgent(normalizedRequest));
    }

    public AgentAuthenticationService.TokenRefreshResult refresh(
            UUID agentId,
            String refreshToken) {
        if (agentId == null) {
            throw new IllegalArgumentException("Agent ID is required");
        }
        UUID tenantId = tenantResolver.resolveByAgentId(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));
        return withTenant(
            tenantId,
            () -> authenticationService.refreshAccessToken(agentId, refreshToken));
    }

    static String normalizeEnrollmentCode(String rawCode) {
        if (rawCode == null) {
            throw new IllegalArgumentException("Enrollment code is required");
        }
        String compact = rawCode.trim()
            .toUpperCase(Locale.ROOT)
            .replaceAll("[^A-Z0-9]", "");
        if (compact.length() != 8) {
            throw new IllegalArgumentException("Invalid enrollment code");
        }
        return compact.substring(0, 4) + "-" + compact.substring(4);
    }

    private <T> T withTenant(UUID tenantId, Supplier<T> action) {
        UUID previousTenant = TenantContext.getTenantId();
        TenantContext.setTenantId(tenantId);
        try {
            return action.get();
        } finally {
            if (previousTenant == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenantId(previousTenant);
            }
        }
    }
}
