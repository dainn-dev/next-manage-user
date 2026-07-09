package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.config.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class PlatformAdminOperationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_pw";
    private static final UUID TENANT_A = UUID.fromString("00000000-0000-0000-0000-0000000a268a");
    private static final UUID TENANT_B = UUID.fromString("00000000-0000-0000-0000-0000000b268b");
    private static final UUID TENANT_CREATED = UUID.fromString("00000000-0000-0000-0000-0000000268aa");
    private static final UUID SITE_A = UUID.fromString("00000000-0000-0000-0000-0000005a268a");
    private static final UUID SITE_B = UUID.fromString("00000000-0000-0000-0000-0000005b268b");

    @DynamicPropertySource
    static void registerAdminDataSource(DynamicPropertyRegistry registry) {
        registry.add("app.admin-datasource.url", POSTGRES::getJdbcUrl);
        registry.add("app.admin-datasource.username", () -> ADMIN_LOGIN);
        registry.add("app.admin-datasource.password", () -> ADMIN_LOGIN_PW);
        registry.add("app.admin-datasource.hikari.maximum-pool-size", () -> "2");
        registry.add("app.admin-datasource.hikari.minimum-idle", () -> "0");
    }

    @BeforeAll
    static void setAdminLoginPassword() throws Exception {
        try (var conn = java.sql.DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var st = conn.createStatement()) {
            st.execute("DO $$ BEGIN "
                    + "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '" + ADMIN_LOGIN + "') THEN "
                    + "CREATE ROLE " + ADMIN_LOGIN + " LOGIN PASSWORD '" + ADMIN_LOGIN_PW + "' NOSUPERUSER BYPASSRLS; "
                    + "ELSE ALTER ROLE " + ADMIN_LOGIN + " WITH LOGIN PASSWORD '" + ADMIN_LOGIN_PW + "' NOSUPERUSER BYPASSRLS; "
                    + "END IF; END $$;");
        }
    }

    @TestConfiguration
    static class AdminGatewayConfig {
        @Bean
        AdminGateway adminGateway() {
            return new AdminGateway();
        }
    }

    static class AdminGateway {
        @PersistenceContext
        private EntityManager em;

        @PlatformAdminOperation
        @Transactional
        public AdminResult createTenantAndReadAllSites() {
            em.createNativeQuery(
                    "INSERT INTO tenant(id, name, slug, status) VALUES (?1, 'admin-created', 'admin-created', 'active') "
                            + "ON CONFLICT (id) DO NOTHING")
                    .setParameter(1, TENANT_CREATED)
                    .executeUpdate();

            @SuppressWarnings("unchecked")
            List<String> tenants = (List<String>) em.createNativeQuery(
                    "SELECT CAST(tenant_id AS text) FROM site ORDER BY tenant_id")
                    .getResultList();
            String currentUser = (String) em.createNativeQuery("SELECT current_user").getSingleResult();
            String isSuperuser = (String) em.createNativeQuery("SHOW is_superuser").getSingleResult();
            return new AdminResult(currentUser, isSuperuser, tenants);
        }
    }

    record AdminResult(String currentUser, String isSuperuser, List<String> visibleTenantIds) {
    }

    @Autowired
    private AdminGateway adminGateway;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void platformAdminOperationUsesAdminPoolAndBypassesTenantRls() {
        seedTenant(TENANT_A, "admin-tenant-a");
        seedTenant(TENANT_B, "admin-tenant-b");
        seedSite(SITE_A, TENANT_A, "admin-site-a");
        seedSite(SITE_B, TENANT_B, "admin-site-b");

        TenantContext.setTenantId(TENANT_A);
        AdminResult result;
        try {
            result = adminGateway.createTenantAndReadAllSites();
        } finally {
            TenantContext.clear();
        }

        assertThat(result.currentUser()).isEqualTo(ADMIN_LOGIN);
        assertThat(result.isSuperuser()).isEqualTo("off");
        assertThat(result.visibleTenantIds().stream().collect(Collectors.toSet()))
                .contains(TENANT_A.toString(), TENANT_B.toString());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tenant WHERE id = ?", Long.class, TENANT_CREATED))
                .isEqualTo(1L);
    }

    private void seedTenant(UUID id, String slug) {
        jdbc.update("INSERT INTO tenant(id, name, slug, status) VALUES (?, ?, ?, 'active') "
                + "ON CONFLICT (id) DO NOTHING", id, slug, slug);
    }

    private void seedSite(UUID id, UUID tenantId, String name) {
        jdbc.update("INSERT INTO site(id, tenant_id, name, location) VALUES (?, ?, ?, 'seed') "
                + "ON CONFLICT (id) DO NOTHING", id, tenantId, name);
    }
}
