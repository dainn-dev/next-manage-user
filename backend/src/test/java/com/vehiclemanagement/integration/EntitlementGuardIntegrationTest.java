package com.vehiclemanagement.integration;

import com.vehiclemanagement.billing.EntitlementExceededException;
import com.vehiclemanagement.billing.EntitlementCheckUnavailableException;
import com.vehiclemanagement.billing.StripeBillingClient;
import com.vehiclemanagement.billing.BillingService;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraCreateRequest;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CreateUserRequest;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.SiteService;
import com.vehiclemanagement.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@TestPropertySource(properties = "billing.enabled=true")
class EntitlementGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID TENANT_ID = UUID.fromString("20000000-0000-0000-0000-000000000277");
    private static final UUID SITE_ID = UUID.fromString("21000000-0000-0000-0000-000000000277");

    @Autowired
    CameraService cameraService;

    @Autowired
    BillingService billingService;

    @Autowired
    SiteService siteService;

    @Autowired
    UserService userService;

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
        restoreFreePlanLimits();
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
    void cameraCrudCreationAlsoStopsAtPlanLimit() {
        seedTenantWithFreePlan();
        seedSite();
        seedCamera("North Entry");
        seedCamera("South Entry");
        TenantContext.setTenantId(TENANT_ID);
        CameraDto request = new CameraDto();
        request.setSiteId(SITE_ID);
        request.setName("CRUD Overflow Camera");

        assertThatThrownBy(() -> cameraService.create(request))
                .isInstanceOf(EntitlementExceededException.class);
    }

    @Test
    void siteCreationStopsAtPlanLimit() {
        seedTenantWithFreePlan();
        seedSite();
        TenantContext.setTenantId(TENANT_ID);
        SiteDto request = new SiteDto();
        request.setName("Overflow Site");

        assertThatThrownBy(() -> siteService.create(request))
                .isInstanceOf(EntitlementExceededException.class);
    }

    @Test
    void userCreationStopsAtPlanLimit() {
        seedTenantWithFreePlan();
        seedTenantUser("seat-one-277");
        seedTenantUser("seat-two-277");
        seedTenantUser("seat-three-277");
        TenantContext.setTenantId(TENANT_ID);
        CreateUserRequest request = new CreateUserRequest();
        request.setUsername("seat-overflow-277");
        request.setEmail("seat-overflow-277@example.com");
        request.setPassword("SecurePass123!");
        request.setRole(User.Role.SITE_MANAGER);
        request.setStatus(User.UserStatus.ACTIVE);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(EntitlementExceededException.class);
    }

    @Test
    void malformedPlanLimitFailsClosed() {
        seedTenantWithFreePlan();
        seedSite();
        TenantContext.setTenantId(TENANT_ID);
        jdbc.update("UPDATE billing_plan SET limits = limits - 'max_cameras_per_site' WHERE code = 'free'");

        assertThatThrownBy(() -> cameraService.create(SITE_ID, cameraRequest("Missing Limit Camera")))
                .isInstanceOf(EntitlementCheckUnavailableException.class);
    }

    @Test
    void concurrentCameraCreationCannotExceedPlanLimit() throws Exception {
        seedTenantWithFreePlan();
        seedSite();
        seedCamera("Existing Camera");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<String>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                String name = "Concurrent Camera " + i;
                results.add(executor.submit(() -> {
                    TenantContext.setTenantId(TENANT_ID);
                    ready.countDown();
                    start.await();
                    try {
                        cameraService.create(SITE_ID, cameraRequest(name));
                        return "success";
                    } catch (RuntimeException ex) {
                        return ex.getClass().getSimpleName();
                    } finally {
                        TenantContext.clear();
                    }
                }));
            }
            ready.await();
            start.countDown();
            List<String> outcomes = results.stream().map(future -> {
                try {
                    return future.get();
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            }).toList();
            assertThat(outcomes).containsExactlyInAnyOrder(
                    "success", EntitlementExceededException.class.getSimpleName());
            assertThat(jdbc.queryForObject(
                    "SELECT count(*) FROM camera WHERE tenant_id = ? AND site_id = ?",
                    Long.class, TENANT_ID, SITE_ID)).isEqualTo(2L);
        } finally {
            executor.shutdownNow();
        }
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
        seedTenantUser("entitlement-user-277");
    }

    private void seedTenantUser(String username) {
        jdbc.update("""
                INSERT INTO users(username, email, password, role, status, tenant_id)
                VALUES (?, ?, 'unused',
                        'TENANT_ADMIN', 'ACTIVE', ?)
                ON CONFLICT (username) DO NOTHING
                """, username, username + "@example.com", TENANT_ID);
    }

    private void restoreFreePlanLimits() {
        jdbc.update("""
                UPDATE billing_plan
                SET limits = '{"max_sites":1,"max_cameras_per_site":2,"retention_days":7,"ai_minutes_month":500,"chatbot_messages_month":100,"users_per_tenant":3}'::jsonb
                WHERE code = 'free'
                """);
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
