package com.vehiclemanagement.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.CameraIngestOutboxRelay;
import com.vehiclemanagement.service.SiteService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.time.OffsetDateTime;

import javax.imageio.ImageIO;
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
@org.junit.jupiter.api.Disabled("Legacy multi-site scenarios are not valid in the one-facility-per-tenant model")
class CameraIngestIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_283_pw";
    private static final String STORAGE_ACCESS_KEY = "minioadmin";
    private static final String STORAGE_SECRET_KEY = "minioadmin";
    private static final String STORAGE_BUCKET = "camera-ingest-test";
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000283aa");

    @SuppressWarnings("resource")
    private static final GenericContainer<?> MINIO = new GenericContainer<>(
            DockerImageName.parse("minio/minio:RELEASE.2024-05-10T01-41-38Z"))
            .withEnv("MINIO_ROOT_USER", STORAGE_ACCESS_KEY)
            .withEnv("MINIO_ROOT_PASSWORD", STORAGE_SECRET_KEY)
            .withCommand("server /data")
            .withExposedPorts(9000);

    static {
        MINIO.start();
    }

    @DynamicPropertySource
    static void registerAdminDataSource(DynamicPropertyRegistry registry) {
        registry.add("app.admin-datasource.url", POSTGRES::getJdbcUrl);
        registry.add("app.admin-datasource.username", () -> ADMIN_LOGIN);
        registry.add("app.admin-datasource.password", () -> ADMIN_LOGIN_PW);
        registry.add("app.admin-datasource.hikari.maximum-pool-size", () -> "1");
        registry.add("app.admin-datasource.hikari.minimum-idle", () -> "0");
        registry.add("object-storage.endpoint",
                () -> "http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000));
        registry.add("object-storage.bucket", () -> STORAGE_BUCKET);
        registry.add("object-storage.region", () -> "us-east-1");
        registry.add("object-storage.access-key", () -> STORAGE_ACCESS_KEY);
        registry.add("object-storage.secret-key", () -> STORAGE_SECRET_KEY);
        registry.add("object-storage.path-style-access", () -> "true");
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

    @Autowired
    CameraIngestOutboxRelay outboxRelay;

    @Autowired
    S3Client s3Client;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void acceptsEventAndReturnsStableResponseForSequentialRetry() {
        long usageBefore = cameraEventUsage();
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
        assertThat(outboxCount(camera.id(), eventId)).isEqualTo(1);
        java.util.Map<String, Object> message = jdbc.queryForMap("""
                SELECT id, routing_key, payload::text AS payload
                  FROM outbox_message
                 WHERE aggregate_type='camera_ingest' AND camera_id=? AND source_event_id=?
                """, camera.id(), eventId.toString());
        assertThat(message.get("routing_key")).isEqualTo("camera.ingest.VehicleDetected");
        assertThat((String) message.get("payload"))
                .contains(eventId.toString(), camera.id().toString(), "51A-12345");

        outboxRelay.relayPending();
        assertThat(jdbc.queryForObject("""
                SELECT status FROM outbox_message
                 WHERE aggregate_type='camera_ingest' AND camera_id=? AND source_event_id=?
                """, String.class, camera.id(), eventId.toString())).isEqualTo("dispatched");
        assertThat(jdbc.queryForObject("""
                SELECT qty FROM billing_usage_record
                 WHERE tenant_id=? AND metric='camera_events_month'
                """, Long.class, TENANT)).isGreaterThanOrEqualTo(usageBefore + 1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM processed_usage_event WHERE message_id=?",
                Long.class, message.get("id"))).isEqualTo(1L);
        outboxRelay.relayPending();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM processed_usage_event WHERE message_id=?",
                Long.class, message.get("id"))).isEqualTo(1L);
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
        assertThat(outboxCount(camera.id(), eventId)).isEqualTo(1);
    }

    @Test
    void storesMultipartSnapshotUnderTrustedTenantAndCameraPrefix() {
        CameraCredentials camera = createCamera("snapshot");
        UUID eventId = UUID.randomUUID();

        ResponseEntity<String> response = postMultipart(camera, eventId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        String snapshotKey = jdbc.queryForObject(
                "SELECT snapshot_path FROM camera_ingest_event WHERE camera_id = ? AND event_id = ?",
                String.class, camera.id(), eventId.toString());
        assertThat(snapshotKey).isEqualTo("tenants/" + TENANT + "/cameras/" + camera.id()
                + "/events/" + eventId + ".png");

        ResponseBytes<GetObjectResponse> stored = s3Client.getObjectAsBytes(builder -> builder
                .bucket(STORAGE_BUCKET)
                .key(snapshotKey));
        assertThat(stored.asByteArray()).startsWith((byte) 0x89, (byte) 0x50, (byte) 0x4e, (byte) 0x47);
        assertThat(stored.response().contentType()).isEqualTo("image/png");
    }

    @Test
    void storesAndLinksOriginalAndPlateCropForOneEvent() {
        CameraCredentials camera = createCamera("multi-snapshot");
        UUID eventId = UUID.randomUUID();
        HttpHeaders eventHeaders = new HttpHeaders();
        eventHeaders.setContentType(MediaType.APPLICATION_JSON);
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("event", new HttpEntity<>(eventBody(eventId, camera.id()), eventHeaders));
        parts.add("original_frame", imagePart("original.png"));
        parts.add("plate_crop", imagePart("plate.png"));
        HttpHeaders headers = cameraHeaders(camera.id(), camera.key());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ResponseEntity<String> response = rest.exchange(url(), HttpMethod.POST,
                new HttpEntity<>(parts, headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        List<java.util.Map<String, Object>> snapshots = jdbc.queryForList("""
                SELECT snapshot.kind,snapshot.object_key
                  FROM camera_ingest_snapshot snapshot
                  JOIN camera_ingest_event event ON event.id=snapshot.event_id
                 WHERE event.camera_id=? AND event.event_id=? ORDER BY snapshot.kind
                """, camera.id(), eventId.toString());
        assertThat(snapshots).extracting(row -> row.get("kind"))
                .containsExactly("original_frame", "plate_crop");
        assertThat(snapshots).allSatisfy(row -> assertThat((String) row.get("object_key"))
                .startsWith("tenants/" + TENANT + "/cameras/" + camera.id() + "/events/" + eventId + "/"));
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

    @Test
    void projectsTrackedDetectionsAndLaterLprIntoSiteScopedOccupancy() {
        CameraCredentials camera = createCamera("tracking");
        UUID slotA = UUID.randomUUID();
        UUID slotB = UUID.randomUUID();
        createPublishedSlots(camera.siteId(), slotA, slotB);
        UUID sessionId = UUID.randomUUID();

        for (int i = 0; i < 3; i++) {
            assertThat(post(camera, trackedEvent(UUID.randomUUID(), camera.id(), "VehicleDetected", sessionId,
                    "42", 1, 1, null, OffsetDateTime.parse("2026-07-14T00:00:00Z")
                            .plusNanos(i * 300_000_000L).toString())).getStatusCode())
                    .isEqualTo(HttpStatus.ACCEPTED);
        }
        assertThat(occupancy(slotA).get("status")).isEqualTo("occupied");
        assertThat(occupancy(slotA).get("plate")).isNull();

        assertThat(post(camera, trackedEvent(UUID.randomUUID(), camera.id(), "PlateRecognized", sessionId,
                "42", null, null, "30A12345", "2026-07-14T00:00:00.700Z")).getStatusCode())
                .isEqualTo(HttpStatus.ACCEPTED);
        assertThat(occupancy(slotA).get("plate")).isEqualTo("30A12345");

        for (int i = 0; i < 5; i++) {
            assertThat(post(camera, trackedEvent(UUID.randomUUID(), camera.id(), "VehicleDetected", sessionId,
                    "42", 3, 1, null, OffsetDateTime.parse("2026-07-14T00:00:01Z")
                            .plusNanos(i * 300_000_000L).toString())).getStatusCode())
                    .isEqualTo(HttpStatus.ACCEPTED);
        }
        assertThat(occupancy(slotA).get("status")).isEqualTo("free");
        assertThat(occupancy(slotB).get("status")).isEqualTo("occupied");
        assertThat(occupancy(slotB).get("plate")).isEqualTo("30A12345");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM parking_event WHERE site_id = ? "
                + "AND event_type = 'VehicleRelocated'", Integer.class, camera.siteId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM parking_event WHERE site_id = ? "
                + "AND event_type = 'VehicleEntered'", Integer.class, camera.siteId())).isEqualTo(1);
        String relocationPayload = jdbc.queryForObject("""
                SELECT payload::text FROM parking_event
                 WHERE site_id=? AND event_type='VehicleRelocated'
                """, String.class, camera.siteId());
        assertThat(relocationPayload).contains("old_slot_geometry_id", "new_slot_geometry_id",
                "old_map_version_id", "new_map_version_id", "assignment", "evidence");

        UUID nextSession = UUID.randomUUID();
        post(camera, trackedEvent(UUID.randomUUID(), camera.id(), "VehicleDetected", nextSession,
                "new-track", 1, 1, null, "2026-07-14T00:00:08Z"));
        assertThat(occupancy(slotB).get("status")).isEqualTo("free");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM parking_event WHERE site_id = ? "
                + "AND event_type = 'VehicleExited'", Integer.class, camera.siteId())).isEqualTo(1);
    }

    @Test
    void replaysRepresentativeTrackingFixtureThroughTheAuthenticatedIngestBoundary() throws Exception {
        CameraCredentials camera = createCamera("fixture-feed");
        UUID slotA = UUID.randomUUID();
        UUID slotB = UUID.randomUUID();
        createPublishedSlots(camera.siteId(), slotA, slotB);

        JsonNode feed = objectMapper.readTree(new ClassPathResource(
                "fixtures/parking/representative-tracking-feed.json").getInputStream());
        for (JsonNode sample : feed) {
            ResponseEntity<String> response = post(camera, fixtureEvent(camera, sample));
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        }

        assertThat(occupancy(slotA).get("status")).isEqualTo("free");
        assertThat(occupancy(slotB).get("status")).isEqualTo("occupied");
        assertThat(occupancy(slotB).get("plate")).isEqualTo("30A-12345");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM parking_event WHERE site_id = ? "
                + "AND event_type = 'VehicleRelocated'", Integer.class, camera.siteId())).isEqualTo(1);
    }

    @Test
    void ignoresPayloadSiteAndSlotClaimsWhenProjectingAnAuthenticatedCamera() {
        CameraCredentials first = createCamera("tracking-first");
        CameraCredentials second = createCamera("tracking-second");
        UUID firstSlot = UUID.randomUUID();
        UUID secondSlot = UUID.randomUUID();
        createPublishedSlots(first.siteId(), firstSlot, UUID.randomUUID());
        createPublishedSlots(second.siteId(), secondSlot, UUID.randomUUID());
        UUID sessionId = UUID.randomUUID();

        String payload = "{\"eventId\":\"" + UUID.randomUUID() + "\",\"cameraId\":\"" + second.id()
                + "\",\"eventType\":\"VehicleDetected\",\"occurredAt\":\"2026-07-14T00:00:00Z\","
                + "\"payload\":{\"tracker\":{\"sessionId\":\"" + sessionId
                + "\",\"trackId\":\"shared-id\"},\"slotObservation\":{\"siteId\":\""
                + first.siteId() + "\",\"provisionalSlotId\":\"" + firstSlot
                + "\",\"referencePoint\":{\"siteMeters\":{\"x\":1,\"y\":1}}}}}";

        assertThat(post(second, payload).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        // Use the regular helper for the remaining confirmation frames; payload scope is still ignored.
        post(second, trackedEvent(UUID.randomUUID(), second.id(), "VehicleDetected", sessionId,
                "shared-id", 1, 1, null, "2026-07-14T00:00:00.300Z"));
        post(second, trackedEvent(UUID.randomUUID(), second.id(), "VehicleDetected", sessionId,
                "shared-id", 1, 1, null, "2026-07-14T00:00:00.600Z"));
        assertThat(occupancy(secondSlot).get("status")).isEqualTo("occupied");
        assertThat(occupancy(firstSlot)).isEmpty();
    }

    private ResponseEntity<String> post(CameraCredentials camera, String body) {
        return rest.exchange(url(), HttpMethod.POST,
                new HttpEntity<>(body, cameraHeaders(camera.id(), camera.key())), String.class);
    }

    private ResponseEntity<String> postMultipart(CameraCredentials camera, UUID eventId) {
        HttpHeaders eventHeaders = new HttpHeaders();
        eventHeaders.setContentType(MediaType.APPLICATION_JSON);
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("event", new HttpEntity<>(eventBody(eventId, camera.id()), eventHeaders));
        parts.add("snapshot", new ByteArrayResource(imageFixture()) {
            @Override
            public String getFilename() {
                return "snapshot.png";
            }
        });

        HttpHeaders headers = cameraHeaders(camera.id(), camera.key());
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return rest.exchange(url(), HttpMethod.POST, new HttpEntity<>(parts, headers), String.class);
    }

    private HttpEntity<ByteArrayResource> imagePart(String filename) {
        return new HttpEntity<>(new ByteArrayResource(imageFixture()) {
            @Override public String getFilename() { return filename; }
        });
    }

    private byte[] imageFixture() {
        try {
            BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
            image.setRGB(0, 0, Color.WHITE.getRGB());
            image.setRGB(1, 1, Color.BLACK.getRGB());
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to create image fixture", ex);
        }
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

    private String trackedEvent(UUID eventId, UUID cameraId, String eventType, UUID sessionId,
                                String trackId, Integer x, Integer y, String plate) {
        return trackedEvent(eventId, cameraId, eventType, sessionId, trackId, x, y, plate,
                "2026-07-14T00:00:00Z");
    }

    private String trackedEvent(UUID eventId, UUID cameraId, String eventType, UUID sessionId,
                                String trackId, Integer x, Integer y, String plate, String occurredAt) {
        String slotObservation = x == null ? "" : ",\"slotObservation\":{\"referencePoint\":{"
                + "\"siteMeters\":{\"x\":" + x + ",\"y\":" + y + "}}}";
        String platePayload = plate == null ? "" : ",\"plate\":{\"normalizedText\":\"" + plate + "\"}";
        return "{\"eventId\":\"" + eventId + "\",\"cameraId\":\"" + cameraId
                + "\",\"eventType\":\"" + eventType + "\",\"occurredAt\":\"" + occurredAt + "\","
                + "\"payload\":{\"tracker\":{\"sessionId\":\"" + sessionId
                + "\",\"trackId\":\"" + trackId + "\"}" + slotObservation + platePayload + "}}";
    }

    private String fixtureEvent(CameraCredentials camera, JsonNode sample) {
        ObjectNode event = objectMapper.createObjectNode();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("cameraId", camera.id().toString());
        event.put("eventType", sample.path("eventType").asText());
        event.put("occurredAt", sample.path("occurredAt").asText());
        event.set("payload", sample.path("payload"));
        return event.toString();
    }

    private void createPublishedSlots(UUID siteId, UUID firstSlot, UUID secondSlot) {
        TenantContext.setTenantId(TENANT);
        try {
            UUID mapVersion = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO site_map_version(id, tenant_id, site_id, version_number, status, published_at)
                    VALUES (?, ?, ?, 1, 'published', CURRENT_TIMESTAMP)
                    """, mapVersion, TENANT, siteId);
            insertSlot(siteId, mapVersion, firstSlot, "A01", "POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))");
            insertSlot(siteId, mapVersion, secondSlot, "A02", "POLYGON((2 0, 4 0, 4 2, 2 2, 2 0))");
        } finally {
            TenantContext.clear();
        }
    }

    private void insertSlot(UUID siteId, UUID mapVersion, UUID slotId, String code, String polygon) {
        jdbc.update("""
                INSERT INTO parking_slot(id, tenant_id, site_id, code)
                VALUES (?, ?, ?, ?)
                """, slotId, TENANT, siteId, code);
        jdbc.update("""
                INSERT INTO parking_slot_geometry(id, tenant_id, site_id, slot_id, map_version_id, polygon)
                VALUES (?, ?, ?, ?, ?, ST_GeomFromText(?, 0))
                """, UUID.randomUUID(), TENANT, siteId, slotId, mapVersion, polygon);
    }

    private java.util.Map<String, Object> occupancy(UUID slotId) {
        List<java.util.Map<String, Object>> rows = jdbc.queryForList(
                "SELECT status, track_id, plate FROM slot_occupancy WHERE slot_id = ?", slotId);
        return rows.isEmpty() ? java.util.Map.of() : rows.get(0);
    }

    private int count(UUID cameraId, UUID eventId) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM camera_ingest_event WHERE camera_id = ? AND event_id = ?",
                Integer.class, cameraId, eventId.toString());
    }

    private int outboxCount(UUID cameraId, UUID eventId) {
        return jdbc.queryForObject("""
                SELECT count(*) FROM outbox_message
                 WHERE aggregate_type='camera_ingest' AND camera_id=? AND source_event_id=?
                """, Integer.class, cameraId, eventId.toString());
    }

    private long cameraEventUsage() {
        return jdbc.query("""
                SELECT qty FROM billing_usage_record
                 WHERE tenant_id=? AND metric='camera_events_month'
                """, (rs, row) -> rs.getLong(1), TENANT).stream().findFirst().orElse(0L);
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
            return new CameraCredentials(camera.getId(), issued.getIngestKey(), site.getId());
        } finally {
            TenantContext.clear();
        }
    }

    private record CameraCredentials(UUID id, String key, UUID siteId) {
    }
}
