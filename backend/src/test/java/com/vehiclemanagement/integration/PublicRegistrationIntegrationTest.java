package com.vehiclemanagement.integration;

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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false",
        "registration.rate-limit.enabled=false"
})
class PublicRegistrationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_pw";

    @DynamicPropertySource
    static void registerAdminDataSource(DynamicPropertyRegistry registry) {
        registry.add("app.admin-datasource.username", () -> ADMIN_LOGIN);
        registry.add("app.admin-datasource.password", () -> ADMIN_LOGIN_PW);
        registry.add("app.admin-datasource.hikari.maximum-pool-size", () -> "2");
        registry.add("app.admin-datasource.hikari.minimum-idle", () -> "0");
    }

    @BeforeAll
    static void configureAdminLogin() throws Exception {
        try (var connection = java.sql.DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("DO $$ BEGIN "
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

    @Test
    void publicRegistrationCreatesTenantSiteAdminAndScopedToken() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> body = Map.of(
                "organizationName", "Nhà trọ Ánh Dương " + unique,
                "managementModel", "boarding-house",
                "areaCount", 3,
                "username", "anhduong-admin-" + unique,
                "email", "anhduong-" + unique + "@example.com",
                "password", "SecurePass123!");

        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(body, jsonHeaders()), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();

        UUID tenantId = UUID.fromString((String) response.getBody().get("tenantId"));
        UUID siteId = UUID.fromString((String) response.getBody().get("siteId"));
        UUID userId = UUID.fromString((String) response.getBody().get("userId"));
        String token = (String) response.getBody().get("token");

        assertThat(response.getBody().get("role")).isEqualTo("TENANT_ADMIN");
        assertThat(response.getBody().get("managementModel")).isEqualTo("boarding-house");
        assertThat(response.getBody().get("areaCount")).isEqualTo(3);
        assertThat(response.getBody().get("siteName")).isEqualTo("Khu vực chính");
        assertThat(jwtUtil.extractTenantId(token)).isEqualTo(tenantId);
        assertThat(jwtUtil.extractSiteIds(token)).containsExactly(siteId);
        assertThat(jwtUtil.extractRole(token)).isEqualTo("TENANT_ADMIN");

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM tenant
                WHERE id = ? AND management_model = 'boarding-house' AND area_count = 3
                """, Long.class, tenantId)).isEqualTo(1L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM site WHERE id = ? AND tenant_id = ?", Long.class, siteId, tenantId))
                .isEqualTo(1L);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM users
                WHERE id = ? AND tenant_id = ? AND role = 'TENANT_ADMIN'
                """, Long.class, userId, tenantId)).isEqualTo(1L);

        HttpHeaders tenantHeaders = jsonHeaders();
        tenantHeaders.setBearerAuth(token);
        ResponseEntity<Map> me = rest.exchange(
                url("/api/auth/me"), HttpMethod.GET, new HttpEntity<>(tenantHeaders), Map.class);
        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody()).containsEntry("id", userId.toString());
    }

    @Test
    void publicRegistrationRejectsDuplicateEmail() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> body = Map.of(
                "organizationName", "Duplicate Registration " + unique,
                "managementModel", "other",
                "areaCount", 1,
                "username", "duplicate-admin-" + unique,
                "email", "duplicate-" + unique + "@example.com",
                "password", "SecurePass123!");

        ResponseEntity<Map> created = rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(body, jsonHeaders()), Map.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        Map<String, Object> duplicate = Map.of(
                "organizationName", "Another Organization " + unique,
                "managementModel", "school",
                "areaCount", 2,
                "username", "another-admin-" + unique,
                "email", "DUPLICATE-" + unique + "@EXAMPLE.COM",
                "password", "SecurePass123!");
        ResponseEntity<Map> conflict = rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(duplicate, jsonHeaders()), Map.class);

        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(conflict.getBody()).containsEntry("message", "Username or email already exists");
    }

    @Test
    void publicRegistrationRejectsCaseInsensitiveDuplicateUsername() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        String username = "case-admin-" + unique;
        Map<String, Object> first = Map.of(
                "organizationName", "Username Organization " + unique,
                "managementModel", "airport",
                "areaCount", 4,
                "username", username,
                "email", "first-" + unique + "@example.com",
                "password", "SecurePass123!");
        Map<String, Object> duplicate = Map.of(
                "organizationName", "Second Username Organization " + unique,
                "managementModel", "hospital",
                "areaCount", 2,
                "username", username.toUpperCase(),
                "email", "second-" + unique + "@example.com",
                "password", "SecurePass123!");

        assertThat(rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(first, jsonHeaders()), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        ResponseEntity<Map> conflict = rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(duplicate, jsonHeaders()), Map.class);

        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(conflict.getBody()).containsEntry("message", "Username or email already exists");
    }

    @Test
    void publicRegistrationRejectsDuplicateOrganizationName() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        String organizationName = "Canonical Organization " + unique;
        Map<String, Object> first = Map.of(
                "organizationName", organizationName,
                "managementModel", "industrial-park",
                "areaCount", 7,
                "username", "org-first-" + unique,
                "email", "org-first-" + unique + "@example.com",
                "password", "SecurePass123!");
        Map<String, Object> duplicate = Map.of(
                "organizationName", organizationName.toUpperCase(),
                "managementModel", "other",
                "areaCount", 1,
                "username", "org-second-" + unique,
                "email", "org-second-" + unique + "@example.com",
                "password", "SecurePass123!");

        assertThat(rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(first, jsonHeaders()), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        ResponseEntity<Map> conflict = rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(duplicate, jsonHeaders()), Map.class);

        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(conflict.getBody()).containsEntry("message", "Tenant name or slug already exists");
    }

    @Test
    void publicRegistrationValidatesEmailAndPassword() {
        Map<String, Object> body = Map.of(
                "organizationName", "Invalid Registration",
                "managementModel", "retail",
                "areaCount", 5,
                "username", "invalid-admin",
                "email", "not-an-email",
                "password", "password");

        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/auth/register"), new HttpEntity<>(body, jsonHeaders()), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsKey("fieldErrors");
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
