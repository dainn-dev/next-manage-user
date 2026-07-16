package com.vehiclemanagement.parking;

import com.vehiclemanagement.controller.ParkingMapContractController;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.assertj.core.api.Assertions.assertThat;

class ParkingMapContractAuthorizationTest {
    @Test
    void commissioningApiIsRestrictedToTenantAdminAndSiteManager() {
        PreAuthorize policy = ParkingMapContractController.class.getAnnotation(PreAuthorize.class);
        assertThat(policy).isNotNull();
        assertThat(policy.value()).contains("TENANT_ADMIN", "SITE_MANAGER");
        assertThat(policy.value()).doesNotContain("SECURITY_GUARD", "MEMBER", "PLATFORM_ADMIN");
    }
}
