package com.vehiclemanagement.security;

import com.vehiclemanagement.config.SiteContext;
import com.vehiclemanagement.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SiteAccessTest {

    private final SiteAccess siteAccess = new SiteAccess();

    @AfterEach
    void clearContexts() {
        SiteContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void tenantAdminIgnoresHistoricalSiteClaim() {
        UUID historicalSite = UUID.randomUUID();
        UUID anotherSite = UUID.randomUUID();
        authenticate(User.Role.TENANT_ADMIN);
        SiteContext.setSiteIds(List.of(historicalSite));

        assertThat(siteAccess.isRestricted()).isFalse();
        assertThat(siteAccess.isSiteAllowed(anotherSite)).isTrue();
    }

    @Test
    void siteManagerRemainsRestrictedToAssignments() {
        UUID assignedSite = UUID.randomUUID();
        authenticate(User.Role.SITE_MANAGER);
        SiteContext.setSiteIds(List.of(assignedSite));

        assertThat(siteAccess.isRestricted()).isTrue();
        assertThat(siteAccess.isSiteAllowed(assignedSite)).isTrue();
        assertThat(siteAccess.isSiteAllowed(UUID.randomUUID())).isFalse();
    }

    @Test
    void siteManagerWithoutAssignmentsFailsClosed() {
        authenticate(User.Role.SITE_MANAGER);
        SiteContext.setSiteIds(List.of());

        assertThat(siteAccess.isRestricted()).isTrue();
        assertThatThrownBy(siteAccess::assertAnyAssignedSite)
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void machineContextRemainsRestrictedByBoundSite() {
        UUID assignedSite = UUID.randomUUID();
        SiteContext.setSiteIds(List.of(assignedSite));

        assertThat(siteAccess.isRestricted()).isTrue();
        assertThat(siteAccess.isSiteAllowed(assignedSite)).isTrue();
        assertThat(siteAccess.isSiteAllowed(UUID.randomUUID())).isFalse();
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
