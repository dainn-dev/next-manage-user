package com.vehiclemanagement.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.util.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Full HTTP/security/database contract for the Stage-5 dashboard read APIs. */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class DashboardApiIntegrationTest extends AbstractPostgresIntegrationTest {
    private final UUID tenantId = UUID.randomUUID();
    private final UUID siteA = UUID.randomUUID();
    private final UUID siteB = UUID.randomUUID();
    private final UUID zoneA = UUID.randomUUID();
    private final UUID slotA = UUID.randomUUID();
    private final UUID cameraA = UUID.randomUUID();
    private final OffsetDateTime base = OffsetDateTime.parse("2026-07-14T03:00:00Z");

    @LocalServerPort int port;
    @Autowired TestRestTemplate rest;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtUtil jwt;
    @Autowired ObjectMapper objectMapper;

    private String adminToken;
    private String managerToken;
    private String guardToken;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        jdbc.update("INSERT INTO tenant(id,name,slug,status,plan_id) VALUES (?,?,?,'active','10000000-0000-0000-0000-000000000002')",
                tenantId, "Dashboard API " + tenantId, "dashboard-api-" + tenantId);
        jdbc.update("INSERT INTO site(id,tenant_id,name) VALUES (?,?,?), (?,?,?)",
                siteA, tenantId, "Site A", siteB, tenantId, "Site B");
        jdbc.update("INSERT INTO zone(id,tenant_id,site_id,name) VALUES (?,?,?,'Zone A')", zoneA, tenantId, siteA);
        jdbc.update("INSERT INTO parking_slot(id,tenant_id,site_id,zone_id,code) VALUES (?,?,?,?, 'A01')",
                slotA, tenantId, siteA, zoneA);
        jdbc.update("INSERT INTO camera(id,tenant_id,site_id,zone_id,name,role,status) VALUES (?,?,?,?,?,'OVERVIEW','online')",
                cameraA, tenantId, siteA, zoneA, "Dashboard camera");

        adminToken = token(User.Role.TENANT_ADMIN, List.of());
        managerToken = token(User.Role.SITE_MANAGER, List.of(siteA));
        guardToken = token(User.Role.SECURITY_GUARD, List.of(siteA));
        seedReadModels();
        TenantContext.clear();
    }

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void dashboardEndpointsRequireAuthenticationAndEnforceAssignedSitesForAllOperatorRoles() {
        assertThat(get("/api/sites/" + siteA + "/events", null).getStatusCode().is4xxClientError()).isTrue();

        assertThat(get("/api/sites/" + siteA + "/events", adminToken).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/api/sites/" + siteA + "/events", managerToken).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/api/sites/" + siteA + "/events", guardToken).getStatusCode()).isEqualTo(HttpStatus.OK);

        assertThat(get("/api/sites/" + siteB + "/events", managerToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/api/sites/" + siteB + "/analytics/average-dwell", guardToken).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/api/vehicles/plate-search?siteId=" + siteB + "&plate=51A12345", managerToken)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void eventTimelineReturnsUnifiedOrderedMetadataSnapshotsFiltersAndPagination() throws Exception {
        JsonNode first = body(get("/api/sites/" + siteA + "/events?page=0&size=2", guardToken));
        assertThat(first.path("totalElements").asLong()).isEqualTo(3);
        assertThat(first.path("hasNext").asBoolean()).isTrue();
        assertThat(first.path("content").get(0).path("type").asText()).isEqualTo("MOTION_DETECTED");
        assertThat(first.path("content").get(0).path("cameraId").asText()).isEqualTo(cameraA.toString());
        assertThat(first.path("content").get(0).path("zoneId").asText()).isEqualTo(zoneA.toString());
        assertThat(first.path("content").get(0).path("snapshotUrl").asText())
                .isEqualTo("/uploads/snapshots/motion.jpg");
        assertThat(first.path("content").get(1).path("type").asText()).isEqualTo("VEHICLE_RELOCATED");
        assertThat(first.path("content").get(1).path("slotId").asText()).isEqualTo(slotA.toString());

        JsonNode filtered = body(get("/api/sites/" + siteA + "/events?zoneId=" + zoneA
                + "&type=VEHICLE_RELOCATED", managerToken));
        assertThat(filtered.path("content")).hasSize(1);
        assertThat(filtered.path("content").get(0).path("plate").asText()).isEqualTo("51A-123.45");
        assertThat(filtered.path("content").get(0).path("snapshotUrl").asText())
                .isEqualTo("/uploads/snapshots/relocated.jpg");

        assertThat(get("/api/sites/" + siteA + "/events?page=-1&size=101", adminToken).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void plateSearchReturnsAuthoritativeSlotLastSeenAndLatestSnapshotWithoutCrossSiteRows() throws Exception {
        JsonNode result = body(get("/api/vehicles/plate-search?siteId=" + siteA + "&plate=51A12345", guardToken));
        assertThat(result).hasSize(1);
        JsonNode vehicle = result.get(0);
        assertThat(vehicle.path("currentSlotId").asText()).isEqualTo(slotA.toString());
        assertThat(vehicle.path("currentSlotCode").asText()).isEqualTo("A01");
        assertThat(vehicle.path("currentZoneId").asText()).isEqualTo(zoneA.toString());
        assertThat(vehicle.path("lastSeenAt").asText()).startsWith(base.plusMinutes(4).toLocalDateTime().toString());
        assertThat(vehicle.path("snapshotUrl").asText()).isEqualTo("/uploads/snapshots/occupancy.jpg");
    }

    @Test
    void averageDwellUsesCompletedValidSessionsAndReturnsSampleCountAndBoundedRange() throws Exception {
        String range = "?from=2026-07-07T00:00:00Z&to=2026-07-15T00:00:00Z";
        JsonNode dwell = body(get("/api/sites/" + siteA + "/analytics/average-dwell" + range, adminToken));
        assertThat(dwell.path("completedSessions").asLong()).isEqualTo(2);
        assertThat(dwell.path("averageDwellSeconds").asDouble()).isEqualTo(3600.0);

        assertThat(get("/api/sites/" + siteA + "/analytics/average-dwell"
                + "?from=2026-01-01T00:00:00Z&to=2026-07-15T00:00:00Z", adminToken).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private void seedReadModels() {
        jdbc.update("""
                INSERT INTO vehicle_log(id,tenant_id,site_id,license_plate_number,type,vehicle_type,entry_exit_time,image_path)
                VALUES (?,?,?,'51A-123.45','entry','external',?,'/uploads/snapshots/gate.jpg')
                """, UUID.randomUUID(), tenantId, siteA, base);
        jdbc.update("""
                INSERT INTO slot_occupancy(slot_id,tenant_id,site_id,zone_id,status,track_id,plate,last_seen_at,
                                           snapshot_reference,snapshot_seen_at)
                VALUES (?,?,?,?,'occupied','dashboard-track','51A-123.45',?, '/uploads/snapshots/occupancy.jpg', ?)
                """, slotA, tenantId, siteA, zoneA, base.plusMinutes(4), base.plusMinutes(4));
        UUID relocationId = UUID.randomUUID();
        String payload = """
                {"payload":{"identity":{"license_plate":"51A-123.45"},"new_slot_id":"%s","new_zone_id":"%s"}}
                """.formatted(slotA, zoneA);
        jdbc.update("""
                INSERT INTO parking_event(id,tenant_id,site_id,event_type,identity_key,transition_sequence,
                                          occurred_at,correlation_id,causation_id,payload)
                VALUES (?,?,?,'VehicleRelocated','dashboard-track',1,?,?,?,CAST(? AS jsonb))
                """, relocationId, tenantId, siteA, base.plusMinutes(2), UUID.randomUUID(), UUID.randomUUID(), payload);
        jdbc.update("""
                INSERT INTO parking_event_snapshot(id,tenant_id,event_id,kind,snapshot_reference)
                VALUES (?,?,?,'relocation_new','/uploads/snapshots/relocated.jpg')
                """, UUID.randomUUID(), tenantId, relocationId);
        jdbc.update("""
                INSERT INTO camera_ingest_event(id,tenant_id,camera_id,event_id,event_type,occurred_at,payload,snapshot_path)
                VALUES (?,?,?,'motion-http','MOTION_DETECTED',?,'{}','/uploads/snapshots/motion.jpg')
                """, UUID.randomUUID(), tenantId, cameraA, base.plusMinutes(3));
        insertSession("CLOSED", base.minusDays(1), base.minusDays(1).plusMinutes(30));
        insertSession("CLOSED", base.minusDays(2), base.minusDays(2).plusMinutes(90));
        insertSession("OPEN", base.minusHours(1), null);
    }

    private void insertSession(String status, OffsetDateTime startedAt, OffsetDateTime endedAt) {
        jdbc.update("""
                INSERT INTO parking_session(id,tenant_id,site_id,license_plate,status,started_at,ended_at)
                VALUES (?,?,?,'51A-123.45',?,?,?)
                """, UUID.randomUUID(), tenantId, siteA, status, startedAt, endedAt);
    }

    private String token(User.Role role, List<UUID> sites) {
        String username = "dash-" + UUID.randomUUID();
        User user = users.save(User.builder().username(username).email(username + "@example.com")
                .password(passwordEncoder.encode("SecurePass123!"))
                .role(role).status(User.UserStatus.ACTIVE).build());
        return jwt.generateToken(user, Map.of("role", role.name(), "email", user.getEmail(),
                "tenant_id", tenantId.toString(), "site_ids", sites.stream().map(UUID::toString).toList()));
    }

    private ResponseEntity<String> get(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        if (token != null) headers.setBearerAuth(token);
        return rest.exchange("http://localhost:" + port + path, HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
    }

    private JsonNode body(ResponseEntity<String> response) throws Exception {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(response.getBody());
    }
}
