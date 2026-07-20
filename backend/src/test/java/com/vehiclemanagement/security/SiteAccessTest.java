package com.vehiclemanagement.security;

import com.vehiclemanagement.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SiteAccessTest {

    private final SiteAccess siteAccess = new SiteAccess();

    @AfterEach
    void clearContexts() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void tenantAdminCanAccessTheSingleTenantFacility() {
        authenticate(User.Role.TENANT_ADMIN);

        assertThat(siteAccess.isRestricted()).isFalse();
        assertThat(siteAccess.isSiteAllowed(UUID.randomUUID())).isTrue();
    }

    @Test
    void operationsManagerDoesNotNeedBranchAssignments() {
        authenticate(User.Role.SITE_MANAGER);

        assertThat(siteAccess.isRestricted()).isFalse();
        assertThat(siteAccess.isSiteAllowed(UUID.randomUUID())).isTrue();
    }

    @Test
    void facilityIdIsStillRequiredForLegacyInternalEndpoints() {
        assertThat(siteAccess.isSiteAllowed(null)).isFalse();
        assertThat(siteAccess.isSiteAllowed(UUID.randomUUID())).isTrue();
    }

    private void authenticate(User.Role role) {
        User user = User.builder()
                .id(UUID.randomUUID())
                .username(role.name().toLowerCase())
                .email(role.name().toLowerCase() + "@example.com")
                .password("")
                .role(role)
                .status(User.UserStatus.ACTIVE)
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }
}
