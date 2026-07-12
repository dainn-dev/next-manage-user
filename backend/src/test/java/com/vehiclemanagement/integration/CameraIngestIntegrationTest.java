package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.SiteService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** DAI-283 durable camera/event idempotency and authenticated ingest contract. */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false",
        "camera-ingest.max-snapshot-bytes=5242880"
})
class CameraIngestIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_283_pw";
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000283aa");

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

    @BeforeEach
    void seedTenant() {
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status, plan_id)
                VALUES (?, 'Camera Ingest Tenant', 'camera-ingest-tenant', 'active',
                        '10000000-0000-0000-0000-000000000002')
                ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id
                """, TENANT);
    }

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    SiteService siteService;

    @Autowired
    CameraService cameraService;

    @Test
    void acceptsEventAndReturnsStableResponseForSequentialRetry() {
        CameraCredentials camera = createCamera("basic");
        UUID eventId = UUID.randomUUID();
        String body = eventBody(eventId, camera.id());

        ResponseEntity<String> first = post(camera, body);
        ResponseEntity<String> retry = post(camera, body);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(retry.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(retry.getBody()).isEqualTo(first.getBody());
        assertThat(count(camera.id(), eventId)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT tenant_id FROM camera_ingest_event WHERE camera_id = ? AND event_id = ?",
                UUID.class, camera.id(), eventId.toString())).isEqualTo(TENANT);
    }

    @Test
    void sameEventIdIsIndependentAcrossCameras() {
        CameraCredentials firstCamera = createCamera("cross-a");
        CameraCredentials secondCamera = createCamera("cross-b");
        UUID eventId = UUID.randomUUID();

        assertThat(post(firstCamera, eventBody(eventId, firstCamera.id())).getStatusCode())
                .isEqualTo(HttpStatus.ACCEPTED);
        assertThat(post(secondCamera, eventBody(eventId, secondCamera.id())).getStatusCode())
                .isEqualTo(HttpStatus.ACCEPTED);

        assertThat(count(firstCamera.id(), eventId)).isEqualTo(1);
        assertThat(count(secondCamera.id(), eventId)).isEqualTo(1);
    }

    @Test
    void concurrentRetriesCreateExactlyOneLedgerRow() throws Exception {
        CameraCredentials camera = createCamera("concurrent");
        UUID eventId = UUID.randomUUID();
        String body = eventBody(eventId, camera.id());
        int workers = 6;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        List<Callable<ResponseEntity<String>>> calls = new ArrayList<>();
        for (int i = 0; i < workers; i++) {
            calls.add(() -> {
                ready.countDown();
                assertThat(start.await(30, TimeUnit.SECONDS)).isTrue();
                return post(camera, body);
            });
        }

        var futures = calls.stream().map(executor::submit).toList();
        assertThat(ready.await(30, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        List<ResponseEntity<String>> responses = new ArrayList<>();
        for (var future : futures) {
            responses.add(future.get(60, TimeUnit.SECONDS));
        }
        executor.shutdownNow();

        assertThat(responses).allSatisfy(response -> {
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
            assertThat(response.getBody()).isEqualTo("{\"eventId\":\"" + eventId
                    + "\",\"status\":\"accepted\"}");
        });
        assertThat(count(camera.id(), eventId)).isEqualTo(1);
    }

    @Test
    void rejectsMalformedAndWrongCameraRequestsWithoutPersistence() {
        CameraCredentials camera = createCamera("reject");
        UUID eventId = UUID.randomUUID();
        String malformed = "{\"eventId\":\"not-a-uuid\",\"eventType\":\"motion\","
                + "\"occurredAt\":\"not-a-time\"}";

        assertThat(post(camera, malformed).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(count(camera.id(), eventId)).isZero();

        UUID otherCameraId = UUID.randomUUID();
        ResponseEntity<String> bodyMismatch = post(camera, eventBody(eventId, otherCameraId));
        assertThat(bodyMismatch.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(count(camera.id(), eventId)).isZero();
    }

    @Test
    void rejectsKeyUsedWithAnotherCameraIdentity() {
        CameraCredentials camera = createCamera("wrong-key");
        UUID eventId = UUID.randomUUID();
        HttpHeaders headers = cameraHeaders(UUID.randomUUID(), camera.key());
        HttpEntity<String> entity = new HttpEntity<>(eventBody(eventId, camera.id()), headers);

        ResponseEntity<String> response = rest.exchange(url(), HttpMethod.POST, entity, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(count(camera.id(), eventId)).isZero();
    }

    private ResponseEntity<String> post(CameraCredentials camera, String body) {
        return rest.exchange(url(), HttpMethod.POST,
                new HttpEntity<>(body, cameraHeaders(camera.id(), camera.key())), String.class);
    }

    private HttpHeaders cameraHeaders(UUID cameraId, String key) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Camera-Id", cameraId.toString());
        headers.set("X-Camera-Key", key);
        return headers;
    }

    private String url() {
        return "http://localhost:" + port + "/api/v1/parking-events";
    }

    private String eventBody(UUID eventId, UUID cameraId) {
        return "{\"eventId\":\"" + eventId + "\",\"cameraId\":\"" + cameraId
                + "\",\"eventType\":\"VehicleDetected\",\"occurredAt\":\"2026-07-12T09:15:30Z\","
                + "\"payload\":{\"licensePlate\":\"51A-12345\",\"confidence\":0.97}}";
    }

    private int count(UUID cameraId, UUID eventId) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM camera_ingest_event WHERE camera_id = ? AND event_id = ?",
                Integer.class, cameraId, eventId.toString());
    }

    private CameraCredentials createCamera(String suffix) {
        TenantContext.setTenantId(TENANT);
        try {
            SiteDto site = siteService.create(SiteDto.builder()
                    .name("Ingest Site " + suffix + " " + UUID.randomUUID())
                    .build());
            CameraDto camera = cameraService.create(CameraDto.builder()
                    .siteId(site.getId())
                    .name("Ingest Camera " + suffix + " " + UUID.randomUUID())
                    .build());
            CameraWithKeyDto issued = cameraService.issueKey(camera.getId());
            return new CameraCredentials(camera.getId(), issued.getIngestKey());
        } finally {
            TenantContext.clear();
        }
    }

    private record CameraCredentials(UUID id, String key) {
    }
}
