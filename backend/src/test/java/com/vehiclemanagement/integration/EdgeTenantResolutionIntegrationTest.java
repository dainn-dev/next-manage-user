package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.VehicleLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class EdgeTenantResolutionIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID OTHER_TENANT = UUID.fromString("00000000-0000-0000-0000-0000000272aa");
    private static final UUID OTHER_SITE = UUID.fromString("00000000-0000-0000-0000-0000005272aa");

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    VehicleLogRepository vehicleLogRepository;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders gateHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Gate-Key", GATE_API_KEY);
        return headers;
    }

    @Test
    void gateCheckWithoutJwtUsesGateTenantForRlsWhenFallbackIsOff() {
        UUID employeeId = UUID.randomUUID();
        UUID vehicleId = UUID.randomUUID();
        UUID gateId = UUID.randomUUID();
        String plate = "R9-" + (System.nanoTime() % 100000);

        seedOtherTenant();
        jdbc.update("""
                INSERT INTO employees(id, employee_id, name, email, department, hire_date, status, tenant_id, created_at, updated_at)
                VALUES (?, ?, 'R9 Driver', ?, 'Security', ?, 'HOAT_DONG', ?, now(), now())
                """, employeeId, "R9-" + employeeId, "r9-" + employeeId + "@example.com",
                LocalDate.now(), OTHER_TENANT);
        jdbc.update("""
                INSERT INTO vehicles(id, employee_id, license_plate, vehicle_type, registration_date, status, tenant_id, created_at, updated_at)
                VALUES (?, ?, ?, 'car', ?, 'approved', ?, now(), now())
                """, vehicleId, employeeId, plate, LocalDate.now(), OTHER_TENANT);
        jdbc.update("""
                INSERT INTO gate(id, name, location, status, tenant_id, site_id, created_at, updated_at)
                VALUES (?, ?, 'R9 Site', 'online', ?, ?, now(), now())
                """, gateId, "R9 Gate " + gateId, OTHER_TENANT, OTHER_SITE);

        Map<String, Object> checkBody = Map.of(
                "licensePlateNumber", plate,
                "type", "entry",
                "gateId", gateId.toString());
        ResponseEntity<Map> response = rest.postForEntity(
                url("/api/vehicles/check-vehicle"),
                new HttpEntity<>(checkBody, gateHeaders()),
                Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("approved")).isEqualTo(Boolean.TRUE);
        assertThat(TenantContext.getTenantId()).isNull();

        TenantContext.setTenantId(OTHER_TENANT);
        try {
            List<VehicleLog> logs = vehicleLogRepository.findByGateSince(gateId, LocalDateTime.now().minusMinutes(5));
            assertThat(logs).hasSize(1);
            assertThat(logs.get(0).getLicensePlateNumber()).isEqualTo(plate);
            assertThat(logs.get(0).getGate().getId()).isEqualTo(gateId);
        } finally {
            TenantContext.clear();
        }
        UUID logTenant = jdbc.queryForObject(
                "SELECT tenant_id FROM vehicle_log WHERE gate_id = ?",
                UUID.class,
                gateId);
        assertThat(logTenant).isEqualTo(OTHER_TENANT);
    }

    private void seedOtherTenant() {
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status)
                VALUES (?, 'R9 Tenant', 'r9-tenant', 'active')
                ON CONFLICT (id) DO NOTHING
                """, OTHER_TENANT);
        jdbc.update("""
                INSERT INTO site(id, tenant_id, name, location)
                VALUES (?, ?, 'R9 Site', 'R9')
                ON CONFLICT (id) DO NOTHING
                """, OTHER_SITE, OTHER_TENANT);
    }
}
