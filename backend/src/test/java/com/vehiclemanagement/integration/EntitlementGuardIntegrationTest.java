package com.vehiclemanagement.integration;

import com.vehiclemanagement.billing.EntitlementExceededException;
import com.vehiclemanagement.billing.StripeBillingClient;
import com.vehiclemanagement.billing.BillingService;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraCreateRequest;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.service.CameraService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EntitlementGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID TENANT_ID = UUID.fromString("20000000-0000-0000-0000-000000000277");
    private static final UUID SITE_ID = UUID.fromString("21000000-0000-0000-0000-000000000277");

    @Autowired
    CameraService cameraService;

    @Autowired
    BillingService billingService;

    @Autowired
    JdbcTemplate jdbc;

    @MockBean
    StripeBillingClient stripeClient;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
        jdbc.update("DELETE FROM camera WHERE tenant_id = ?", TENANT_ID);
        jdbc.update("DELETE FROM site WHERE tenant_id = ?", TENANT_ID);
        jdbc.update("DELETE FROM users WHERE tenant_id = ?", TENANT_ID);
        jdbc.update("DELETE FROM billing_subscription WHERE tenant_id = ?", TENANT_ID);
        jdbc.update("DELETE FROM tenant WHERE id = ?", TENANT_ID);
    }

    @Test
    void tenantCameraCreationStopsAtPlanLimit() {
        seedTenantWithFreePlan();
        seedSite();
        seedCamera("North Entry");
        seedCamera("South Entry");
        TenantContext.setTenantId(TENANT_ID);

        CameraCreateRequest request = cameraRequest("Overflow Camera");

        assertThatThrownBy(() -> cameraService.create(SITE_ID, request))
                .isInstanceOf(EntitlementExceededException.class)
                .satisfies(ex -> {
                    EntitlementExceededException entitlement = (EntitlementExceededException) ex;
                    assertThat(entitlement.getCode()).isEqualTo("ENTITLEMENT_EXCEEDED");
                    assertThat(entitlement.getMetric()).isEqualTo("max_cameras_per_site");
                    assertThat(entitlement.getLimit()).isEqualTo(2);
                    assertThat(entitlement.getCurrentUsage()).isEqualTo(2);
                });
    }

    @Test
    void platformAdminBypassesCameraLimit() {
        seedTenantWithFreePlan();
        seedSite();
        seedCamera("North Entry");
        seedCamera("South Entry");
        TenantContext.setTenantId(TENANT_ID);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "platform-admin",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"))));

        var created = cameraService.create(SITE_ID, cameraRequest("Platform Added Camera"));

        assertThat(created.getId()).isNotNull();
        assertThat(created.getIngestKey()).isNotBlank();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM camera WHERE tenant_id = ?", Long.class, TENANT_ID))
                .isEqualTo(3L);
    }

    @Test
    void billingStatusReportsStructuralUsageFromLocalTables() {
        seedTenantWithFreePlan();
        seedSite();
        seedCamera("North Entry");
        seedTenantUser();
        TenantContext.setTenantId(TENANT_ID);

        var status = billingService.getBillingStatus();

        assertThat(status.planCode()).isEqualTo("free");
        assertThat(status.usage()).containsEntry("max_sites", 1L);
        assertThat(status.usage()).containsEntry("max_cameras_per_site", 1L);
        assertThat(status.usage()).containsEntry("users_per_tenant", 1L);
    }

    private void seedTenantWithFreePlan() {
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status, plan_id)
                VALUES (?, 'Entitlement Tenant', 'entitlement-tenant-277', 'active',
                        '10000000-0000-0000-0000-000000000001')
                ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id
                """, TENANT_ID);
    }

    private void seedSite() {
        jdbc.update("""
                INSERT INTO site(id, tenant_id, name, location)
                VALUES (?, ?, 'Main Garage', 'District 1')
                ON CONFLICT (id) DO NOTHING
                """, SITE_ID, TENANT_ID);
    }

    private void seedCamera(String name) {
        jdbc.update("""
                INSERT INTO camera(tenant_id, site_id, name, role, status)
                VALUES (?, ?, ?, 'ANPR_GATE', 'provisioned')
                ON CONFLICT (site_id, name) DO NOTHING
                """, TENANT_ID, SITE_ID, name);
    }

    private void seedTenantUser() {
        jdbc.update("""
                INSERT INTO users(username, email, password, role, status, tenant_id)
                VALUES ('entitlement-user-277', 'entitlement-user-277@example.com', 'unused',
                        'TENANT_ADMIN', 'ACTIVE', ?)
                ON CONFLICT (username) DO NOTHING
                """, TENANT_ID);
    }

    private CameraCreateRequest cameraRequest(String name) {
        CameraCreateRequest request = new CameraCreateRequest();
        request.setName(name);
        request.setRtspUrl("rtsp://example.test/" + name.toLowerCase().replace(' ', '-'));
        request.setRole(Camera.CameraRole.ANPR_GATE);
        request.setPanelType(Camera.PanelType.entry);
        return request;
    }
}
