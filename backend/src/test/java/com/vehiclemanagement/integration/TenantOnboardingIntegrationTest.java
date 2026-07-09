package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.util.JwtUtil;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.sql.DriverManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class TenantOnboardingIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_pw";

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
        try (var conn = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var st = conn.createStatement()) {
            st.execute("DO $$ BEGIN "
                    + "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '" + ADMIN_LOGIN + "') THEN "
                    + "CREATE ROLE " + ADMIN_LOGIN + " LOGIN PASSWORD '" + ADMIN_LOGIN_PW + "' NOSUPERUSER BYPASSRLS; "
                    + "ELSE ALTER ROLE " + ADMIN_LOGIN + " WITH LOGIN PASSWORD '" + ADMIN_LOGIN_PW + "' NOSUPERUSER BYPASSRLS; "
                    + "END IF; END $$;");
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtUtil jwtUtil;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    UserRepository userRepository;

    @Test
    void platformAdminCanOnboardTenantSiteAndFirstTenantAdmin() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> body = Map.of(
                "tenantName", "Acme Parking " + unique,
                "siteName", "Main Garage " + unique,
                "siteLocation", "District 1",
                "adminUsername", "tenant-admin-" + unique,
                "adminEmail", "tenant-admin-" + unique + "@example.com",
                "adminPassword", "SecurePass123!");

        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/v1/tenants"), new HttpEntity<>(body, platformAdminHeaders()), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();

        UUID tenantId = UUID.fromString((String) response.getBody().get("tenantId"));
        UUID siteId = UUID.fromString((String) response.getBody().get("siteId"));
        UUID adminUserId = UUID.fromString((String) response.getBody().get("adminUserId"));
        String token = (String) response.getBody().get("token");

        assertThat(response.getBody().get("role")).isEqualTo("TENANT_ADMIN");
        assertThat(jwtUtil.extractTenantId(token)).isEqualTo(tenantId);
        assertThat(jwtUtil.extractSiteIds(token)).containsExactly(siteId);
        assertThat(jwtUtil.extractRole(token)).isEqualTo("TENANT_ADMIN");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM tenant WHERE id = ?", Long.class, tenantId))
                .isEqualTo(1L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM site WHERE id = ? AND tenant_id = ?", Long.class, siteId, tenantId))
                .isEqualTo(1L);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM users
                WHERE id = ? AND tenant_id = ? AND role = 'TENANT_ADMIN'
                """, Long.class, adminUserId, tenantId)).isEqualTo(1L);

        HttpHeaders tenantHeaders = jsonHeaders();
        tenantHeaders.setBearerAuth(token);
        ResponseEntity<Map> me = rest.exchange(
                url("/api/auth/me"), HttpMethod.GET, new HttpEntity<>(tenantHeaders), Map.class);
        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody()).isNotNull();
        assertThat(me.getBody().get("id")).isEqualTo(adminUserId.toString());

        TenantContext.setTenantId(tenantId);
        try {
            List<UUID> visibleUserIds = userRepository.findAll().stream().map(User::getId).toList();
            assertThat(visibleUserIds).contains(adminUserId);
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void onboardingRejectsDuplicateTenantAndDuplicateAdminEmail() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> first = Map.of(
                "tenantName", "Duplicate Tenant " + unique,
                "siteName", "Duplicate Site " + unique,
                "adminUsername", "dup-admin-" + unique,
                "adminEmail", "dup-admin-" + unique + "@example.com",
                "adminPassword", "SecurePass123!");

        ResponseEntity<Map> created = rest.postForEntity(
                url("/api/v1/tenants"), new HttpEntity<>(first, platformAdminHeaders()), Map.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        Map<String, Object> duplicateTenant = Map.of(
                "tenantName", "Duplicate Tenant " + unique,
                "siteName", "Other Site " + unique,
                "adminUsername", "dup-admin-other-" + unique,
                "adminEmail", "dup-admin-other-" + unique + "@example.com",
                "adminPassword", "SecurePass123!");
        ResponseEntity<Map> tenantConflict = rest.postForEntity(
                url("/api/v1/tenants"), new HttpEntity<>(duplicateTenant, platformAdminHeaders()), Map.class);
        assertThat(tenantConflict.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        Map<String, Object> duplicateEmail = Map.of(
                "tenantName", "Other Tenant " + unique,
                "siteName", "Other Site " + unique,
                "adminUsername", "dup-admin-email-" + unique,
                "adminEmail", "dup-admin-" + unique + "@example.com",
                "adminPassword", "SecurePass123!");
        ResponseEntity<Map> emailConflict = rest.postForEntity(
                url("/api/v1/tenants"), new HttpEntity<>(duplicateEmail, platformAdminHeaders()), Map.class);
        assertThat(emailConflict.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void onboardingRejectsInvalidInitialAdminRole() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> body = Map.of(
                "tenantName", "Role Tenant " + unique,
                "siteName", "Role Site " + unique,
                "adminUsername", "role-admin-" + unique,
                "adminEmail", "role-admin-" + unique + "@example.com",
                "adminPassword", "SecurePass123!",
                "adminRole", "MEMBER");

        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/v1/tenants"), new HttpEntity<>(body, platformAdminHeaders()), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders platformAdminHeaders() {
        seedPlatformAdmin();
        HttpHeaders headers = jsonHeaders();
        headers.setBearerAuth(platformAdminToken());
        return headers;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private void seedPlatformAdmin() {
        jdbc.update("""
                INSERT INTO users(username, email, password, first_name, last_name,
                                  role, status, tenant_id, created_at, updated_at)
                VALUES ('platform_admin', 'platform-admin-onboarding@example.com', ?,
                        'Platform', 'Admin', 'PLATFORM_ADMIN', 'ACTIVE', NULL, now(), now())
                ON CONFLICT (username) DO NOTHING
                """, passwordEncoder.encode("SecurePass123!"));
    }

    private String platformAdminToken() {
        User platformAdmin = User.builder()
                .username("platform_admin")
                .email("platform-admin-onboarding@example.com")
                .password("")
                .role(User.Role.PLATFORM_ADMIN)
                .status(User.UserStatus.ACTIVE)
                .build();
        return jwtUtil.generateToken(platformAdmin, Map.of(
                "role", "PLATFORM_ADMIN",
                "email", "platform-admin-onboarding@example.com"));
    }
}
