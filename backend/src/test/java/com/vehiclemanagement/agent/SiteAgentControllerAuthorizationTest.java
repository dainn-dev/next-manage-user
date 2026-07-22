package com.vehiclemanagement.agent;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class SiteAgentControllerAuthorizationTest {

    @Test
    void managementEndpointsAllowTenantAdminAndSiteManager() {
        var managementMethods = Arrays.stream(SiteAgentController.class.getDeclaredMethods())
            .filter(method -> !method.isSynthetic())
            .filter(method -> method.getAnnotation(PreAuthorize.class) != null)
            .toList();

        assertThat(managementMethods)
            .extracting(Method::getName)
            .containsExactlyInAnyOrder("listAgents", "createEnrollmentCode", "revokeAgent", "getAgent");

        assertThat(managementMethods).allSatisfy(method -> {
            String policy = method.getAnnotation(PreAuthorize.class).value();
            assertThat(policy).contains("TENANT_ADMIN", "SITE_MANAGER");
            assertThat(policy).doesNotContain("'ADMIN'", "SECURITY_GUARD", "MEMBER", "PLATFORM_ADMIN");
        });
    }
}
