package com.vehiclemanagement.agent;

import com.vehiclemanagement.config.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AgentPublicAuthenticationCoordinatorTest {

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void enrollmentResolvesAndBindsTenantBeforeTransactionalAuthentication() {
        UUID tenantId = UUID.randomUUID();
        var resolver = new StubTenantResolver(tenantId);
        var authentication = new StubAuthenticationService();
        var coordinator = new AgentPublicAuthenticationCoordinator(resolver, authentication);
        var request = new AgentAuthenticationService.EnrollmentRequest(
            " abcd efgh ", "Test agent", "fingerprint", "0.1.0", "linux-x86_64");

        var result = coordinator.enroll(request);

        assertThat(result.tenantId()).isEqualTo(tenantId);
        assertThat(authentication.enrollmentRequest.enrollmentCode()).isEqualTo("ABCD-EFGH");
        assertThat(authentication.tenantSeenDuringEnrollment).isEqualTo(tenantId);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void refreshResolvesTenantFromAgentBeforeAuthentication() {
        UUID tenantId = UUID.randomUUID();
        UUID agentId = UUID.randomUUID();
        var resolver = new StubTenantResolver(tenantId);
        var authentication = new StubAuthenticationService();
        var coordinator = new AgentPublicAuthenticationCoordinator(resolver, authentication);

        assertThat(coordinator.refresh(agentId, "refresh").accessToken()).isEqualTo("access");
        assertThat(authentication.tenantSeenDuringRefresh).isEqualTo(tenantId);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    private static final class StubTenantResolver extends AgentTenantResolver {
        private final UUID tenantId;

        private StubTenantResolver(UUID tenantId) {
            super(null);
            this.tenantId = tenantId;
        }

        @Override
        public Optional<UUID> resolveByEnrollmentCode(String code) {
            return Optional.of(tenantId);
        }

        @Override
        public Optional<UUID> resolveByAgentId(UUID agentId) {
            return Optional.of(tenantId);
        }
    }

    private static final class StubAuthenticationService extends AgentAuthenticationService {
        private EnrollmentRequest enrollmentRequest;
        private UUID tenantSeenDuringEnrollment;
        private UUID tenantSeenDuringRefresh;

        private StubAuthenticationService() {
            super(null, null, null, null);
        }

        @Override
        public EnrollmentResult enrollAgent(EnrollmentRequest request) {
            enrollmentRequest = request;
            tenantSeenDuringEnrollment = TenantContext.getTenantId();
            return new EnrollmentResult(
                new SiteAgent(), tenantSeenDuringEnrollment, "access", "refresh");
        }

        @Override
        public TokenRefreshResult refreshAccessToken(UUID agentId, String refreshToken) {
            tenantSeenDuringRefresh = TenantContext.getTenantId();
            return new TokenRefreshResult("access");
        }
    }
}
