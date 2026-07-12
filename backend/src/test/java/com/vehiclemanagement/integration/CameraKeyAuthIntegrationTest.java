package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.SiteService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** DAI-282 camera credential issuance, rotation, revocation, and RLS binding. */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false",
        "camera-credentials.rotation-grace-period=2h"
})
class CameraKeyAuthIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_pw";
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000282aa");

    @DynamicPropertySource
    static void registerAdminDataSource(DynamicPropertyRegistry registry) {
        registry.add("app.admin-datasource.url", POSTGRES::getJdbcUrl);
        registry.add("app.admin-datasource.username", () -> ADMIN_LOGIN);
        registry.add("app.admin-datasource.password", () -> ADMIN_LOGIN_PW);
        registry.add("app.admin-datasource.hikari.maximum-pool-size", () -> "1");
        registry.add("app.admin-datasource.hikari.minimum-idle", () -> "0");
    }

    @BeforeAll
    static void setAdminLoginPassword() throws Exception {
        try (var conn = java.sql.DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var st = conn.createStatement()) {
            st.execute("DO $$ BEGIN "
                    + "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '" + ADMIN_LOGIN + "') THEN "
                    + "CREATE ROLE " + ADMIN_LOGIN + " LOGIN PASSWORD '" + ADMIN_LOGIN_PW
                    + "' NOSUPERUSER BYPASSRLS; "
                    + "ELSE ALTER ROLE " + ADMIN_LOGIN + " WITH LOGIN PASSWORD '" + ADMIN_LOGIN_PW
                    + "' NOSUPERUSER BYPASSRLS; END IF; END $$;");
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    SiteService siteService;

    @Autowired
    CameraService cameraService;

    @Test
    void activeAndGraceKeysAuthenticateThenExpiredAndDisabledKeysFail() {
        seedTenant();
        UUID siteId;
        CameraWithKeyDto issued;
        TenantContext.setTenantId(TENANT);
        try {
            siteId = siteService.create(SiteDto.builder()
                    .name("Credential Site " + UUID.randomUUID())
                    .build()).getId();
            CameraDto created = cameraService.create(CameraDto.builder()
                    .siteId(siteId)
                    .name("Credential Camera " + UUID.randomUUID())
                    .build());
            issued = cameraService.issueKey(created.getId());
        } finally {
            TenantContext.clear();
        }

        assertThat(issued.getIngestKey()).isNotBlank();
        assertThat(issued.getPreviousKeyExpiresAt()).isNull();
        assertThat(jdbc.queryForObject(
                "SELECT api_key_hash <> ? FROM camera WHERE id = ?",
                Boolean.class,
                issued.getIngestKey(),
                issued.getId())).isTrue();
        assertHeartbeat(issued.getId(), issued.getIngestKey(), HttpStatus.OK);

        CameraWithKeyDto rotated;
        TenantContext.setTenantId(TENANT);
        try {
            rotated = cameraService.rotateKey(issued.getId());
        } finally {
            TenantContext.clear();
        }

        assertThat(rotated.getIngestKey()).isNotBlank().isNotEqualTo(issued.getIngestKey());
        assertThat(rotated.getPreviousKeyExpiresAt()).isAfter(LocalDateTime.now());
        assertHeartbeat(issued.getId(), issued.getIngestKey(), HttpStatus.OK);
        assertHeartbeat(issued.getId(), rotated.getIngestKey(), HttpStatus.OK);

        jdbc.update("UPDATE camera SET previous_api_key_expires_at = now() - interval '1 second' WHERE id = ?",
                issued.getId());
        assertHeartbeat(issued.getId(), issued.getIngestKey(), HttpStatus.UNAUTHORIZED);
        assertHeartbeat(issued.getId(), rotated.getIngestKey(), HttpStatus.OK);

        jdbc.update("UPDATE camera SET status = 'disabled' WHERE id = ?", issued.getId());
        assertHeartbeat(issued.getId(), rotated.getIngestKey(), HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongCameraIdMissingKeyAndJwtAreRejected() {
        seedTenant();
        CameraWithKeyDto issued;
        TenantContext.setTenantId(TENANT);
        try {
            UUID siteId = siteService.create(SiteDto.builder()
                    .name("Reject Site " + UUID.randomUUID())
                    .build()).getId();
            CameraDto created = cameraService.create(CameraDto.builder()
                    .siteId(siteId)
                    .name("Reject Camera " + UUID.randomUUID())
                    .build());
            issued = cameraService.issueKey(created.getId());
        } finally {
            TenantContext.clear();
        }

        assertHeartbeat(UUID.randomUUID(), issued.getIngestKey(), HttpStatus.UNAUTHORIZED);
        assertHeartbeat(issued.getId(), "wrong-key", HttpStatus.UNAUTHORIZED);

        HttpHeaders missingKey = new HttpHeaders();
        missingKey.set("X-Camera-Id", issued.getId().toString());
        assertThat(exchangeHeartbeat(issued.getId(), missingKey).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        HttpHeaders withJwt = cameraHeaders(issued.getId(), issued.getIngestKey());
        withJwt.setBearerAuth("not-a-user-token");
        assertThat(exchangeHeartbeat(issued.getId(), withJwt).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private void assertHeartbeat(UUID cameraId, String key, HttpStatus expected) {
        ResponseEntity<CameraDto> response = exchangeHeartbeat(
                cameraId,
                cameraHeaders(cameraId, key));
        assertThat(response.getStatusCode()).isEqualTo(expected);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    private ResponseEntity<CameraDto> exchangeHeartbeat(UUID pathCameraId, HttpHeaders headers) {
        return rest.exchange(
                "http://localhost:" + port + "/api/cameras/" + pathCameraId + "/heartbeat",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                CameraDto.class);
    }

    private HttpHeaders cameraHeaders(UUID cameraId, String key) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Camera-Id", cameraId.toString());
        headers.set("X-Camera-Key", key);
        return headers;
    }

    private void seedTenant() {
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status, plan_id)
                VALUES (?, 'Camera Credential Tenant', 'camera-credential-tenant', 'active',
                        '10000000-0000-0000-0000-000000000002')
                ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id
                """, TENANT);
    }
}
