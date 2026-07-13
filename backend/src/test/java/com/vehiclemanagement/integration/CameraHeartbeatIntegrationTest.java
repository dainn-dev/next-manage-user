package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.SiteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** DAI-284 camera heartbeat liveness transitions and cross-tenant stale sweep. */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false",
        "camera.heartbeat-check-rate-ms=86400000"
})
class CameraHeartbeatIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID TENANT_A = UUID.fromString("00000000-0000-0000-0000-0000000284aa");
    private static final UUID TENANT_B = UUID.fromString("00000000-0000-0000-0000-0000000284bb");

    @Autowired
    private CameraService cameraService;

    @Autowired
    private SiteService siteService;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void heartbeatRestoresOnlineAndSweepOnlyTransitionsStaleOnlineCamerasAcrossTenants() {
        seedTenant(TENANT_A, "camera-heartbeat-a");
        seedTenant(TENANT_B, "camera-heartbeat-b");

        CameraDto staleA = createCamera(TENANT_A, Camera.CameraStatus.offline);
        CameraDto staleB = createCamera(TENANT_B, Camera.CameraStatus.offline);
        CameraDto fresh = createCamera(TENANT_A, Camera.CameraStatus.offline);
        CameraDto provisioned = createCamera(TENANT_A, Camera.CameraStatus.provisioned);
        CameraDto disabled = createCamera(TENANT_B, Camera.CameraStatus.disabled);

        LocalDateTime beforeHeartbeat = LocalDateTime.now();
        CameraDto heartbeatA = heartbeat(TENANT_A, staleA.getId());
        CameraDto heartbeatB = heartbeat(TENANT_B, staleB.getId());
        CameraDto freshHeartbeat = heartbeat(TENANT_A, fresh.getId());

        assertThat(heartbeatA.getStatus()).isEqualTo(Camera.CameraStatus.online);
        assertThat(heartbeatA.getLastHeartbeatAt()).isAfterOrEqualTo(beforeHeartbeat);
        assertThat(heartbeatB.getStatus()).isEqualTo(Camera.CameraStatus.online);
        assertThat(freshHeartbeat.getStatus()).isEqualTo(Camera.CameraStatus.online);

        setHeartbeatStale(staleA.getId());
        setHeartbeatStale(staleB.getId());
        setHeartbeatStale(provisioned.getId());
        setHeartbeatStale(disabled.getId());

        assertThat(TenantContext.getTenantId()).isNull();
        cameraService.markStaleCamerasOffline();

        assertStatus(staleA.getId(), Camera.CameraStatus.offline);
        assertStatus(staleB.getId(), Camera.CameraStatus.offline);
        assertStatus(fresh.getId(), Camera.CameraStatus.online);
        assertStatus(provisioned.getId(), Camera.CameraStatus.provisioned);
        assertStatus(disabled.getId(), Camera.CameraStatus.disabled);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    private CameraDto createCamera(UUID tenantId, Camera.CameraStatus status) {
        TenantContext.setTenantId(tenantId);
        try {
            UUID siteId = siteService.create(SiteDto.builder()
                    .name("Heartbeat Site " + UUID.randomUUID())
                    .build()).getId();
            return cameraService.create(CameraDto.builder()
                    .siteId(siteId)
                    .name("Heartbeat Camera " + UUID.randomUUID())
                    .status(status)
                    .build());
        } finally {
            TenantContext.clear();
        }
    }

    private CameraDto heartbeat(UUID tenantId, UUID cameraId) {
        TenantContext.setTenantId(tenantId);
        try {
            return cameraService.heartbeat(cameraId);
        } finally {
            TenantContext.clear();
        }
    }

    private void setHeartbeatStale(UUID cameraId) {
        jdbc.update("UPDATE camera SET last_heartbeat_at = now() - interval '2 minutes' WHERE id = ?", cameraId);
    }

    private void assertStatus(UUID cameraId, Camera.CameraStatus status) {
        assertThat(jdbc.queryForObject("SELECT status FROM camera WHERE id = ?", String.class, cameraId))
                .isEqualTo(status.name());
    }

    private void seedTenant(UUID id, String slug) {
        jdbc.update("DELETE FROM camera WHERE tenant_id = ?", id);
        jdbc.update("DELETE FROM site WHERE tenant_id = ?", id);
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status, plan_id)
                VALUES (?, ?, ?, 'active', '10000000-0000-0000-0000-000000000002')
                ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id
                """, id, slug, slug);
    }
}
