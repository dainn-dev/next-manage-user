package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.dto.ZoneDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.SiteService;
import com.vehiclemanagement.service.ZoneService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * DAI-281: tenant-scoped Site/Zone/Camera CRUD proven end-to-end against a real
 * PostgreSQL with Stage 1 RLS enforced. Runs the service layer under an explicitly
 * bound {@link TenantContext} (the same path the web filters set up per request),
 * with the default-tenant fallback OFF so an unbound context is fail-closed.
 *
 * <p>Covers the acceptance criteria:
 * <ul>
 *   <li>CRUD works and is tenant-scoped.</li>
 *   <li>Tenant B cannot read tenant A's rows (RLS).</li>
 *   <li>A camera whose zone is in a different site is rejected (400 → IllegalArgumentException).</li>
 *   <li>A duplicate camera name within a site is rejected (409 → ConflictException).</li>
 * </ul>
 */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class CameraManagementIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID TENANT_A = UUID.fromString("00000000-0000-0000-0000-0000000281aa");
    private static final UUID TENANT_B = UUID.fromString("00000000-0000-0000-0000-0000000281bb");

    @Autowired
    private SiteService siteService;

    @Autowired
    private ZoneService zoneService;

    @Autowired
    private CameraService cameraService;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void fullCrudRoundTripUnderOneTenant() {
        seedTenant(TENANT_A, "tenant-a-crud");
        TenantContext.setTenantId(TENANT_A);
        try {
            SiteDto site = siteService.create(SiteDto.builder().name("HQ").location("Hanoi").build());
            assertThat(site.getId()).isNotNull();

            ZoneDto zone = zoneService.create(ZoneDto.builder().siteId(site.getId()).name("Lobby").build());
            assertThat(zone.getId()).isNotNull();

            CameraDto camera = cameraService.create(CameraDto.builder()
                    .siteId(site.getId()).zoneId(zone.getId()).name("North Entry")
                    .rtspUrl("rtsp://cam/1").build());
            assertThat(camera.getId()).isNotNull();
            assertThat(camera.getStatus()).isEqualTo(Camera.CameraStatus.provisioned);
            assertThat(camera.getRole()).isEqualTo(Camera.CameraRole.ANPR_GATE);

            // list / get
            assertThat(siteService.list()).extracting(SiteDto::getId).contains(site.getId());
            assertThat(cameraService.list(site.getId())).extracting(CameraDto::getId).contains(camera.getId());
            assertThat(cameraService.get(camera.getId()).getName()).isEqualTo("North Entry");

            // update
            CameraDto updated = cameraService.update(camera.getId(),
                    CameraDto.builder().name("North Gate").status(Camera.CameraStatus.online).build());
            assertThat(updated.getName()).isEqualTo("North Gate");
            assertThat(updated.getStatus()).isEqualTo(Camera.CameraStatus.online);

            // delete
            cameraService.delete(camera.getId());
            assertThatThrownBy(() -> cameraService.get(camera.getId()))
                    .isInstanceOf(ResourceNotFoundException.class);
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void tenantBCannotReadTenantASites() {
        seedTenant(TENANT_A, "tenant-a-iso");
        seedTenant(TENANT_B, "tenant-b-iso");

        UUID siteA;
        TenantContext.setTenantId(TENANT_A);
        try {
            siteA = siteService.create(SiteDto.builder().name("A-Only Site").build()).getId();
        } finally {
            TenantContext.clear();
        }

        // Tenant B sees none of tenant A's sites, and cannot fetch one by id.
        TenantContext.setTenantId(TENANT_B);
        try {
            assertThat(siteService.list()).extracting(SiteDto::getId).doesNotContain(siteA);
            UUID target = siteA;
            assertThatThrownBy(() -> siteService.get(target))
                    .isInstanceOf(ResourceNotFoundException.class);
        } finally {
            TenantContext.clear();
        }

        // The row genuinely exists (visible via the RLS-bypassing superuser connection),
        // proving the block above is RLS, not a missing row.
        Long count = jdbc.queryForObject("SELECT count(*) FROM site WHERE id = ?", Long.class, siteA);
        assertThat(count).isEqualTo(1L);
    }

    @Test
    void rejectsCameraWhoseZoneIsInADifferentSite() {
        seedTenant(TENANT_A, "tenant-a-zone");
        TenantContext.setTenantId(TENANT_A);
        try {
            UUID siteOne = siteService.create(SiteDto.builder().name("Site One").build()).getId();
            UUID siteTwo = siteService.create(SiteDto.builder().name("Site Two").build()).getId();
            UUID zoneInTwo = zoneService.create(ZoneDto.builder().siteId(siteTwo).name("Z2").build()).getId();

            assertThatThrownBy(() -> cameraService.create(CameraDto.builder()
                    .siteId(siteOne).zoneId(zoneInTwo).name("Mismatch").build()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not belong to site");
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void rejectsDuplicateCameraNameWithinASite() {
        seedTenant(TENANT_A, "tenant-a-dup");
        TenantContext.setTenantId(TENANT_A);
        try {
            UUID site = siteService.create(SiteDto.builder().name("Dup Site").build()).getId();
            cameraService.create(CameraDto.builder().siteId(site).name("Cam-1").build());

            assertThatThrownBy(() -> cameraService.create(CameraDto.builder()
                    .siteId(site).name("Cam-1").build()))
                    .isInstanceOf(ConflictException.class)
                    .hasMessageContaining("already exists");

            // The same name IS allowed in a different site.
            UUID otherSite = siteService.create(SiteDto.builder().name("Dup Site 2").build()).getId();
            CameraDto ok = cameraService.create(CameraDto.builder().siteId(otherSite).name("Cam-1").build());
            assertThat(ok.getId()).isNotNull();
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void rejectsZoneOnACrossTenantSite() {
        seedTenant(TENANT_A, "tenant-a-x");
        seedTenant(TENANT_B, "tenant-b-x");

        UUID siteA;
        TenantContext.setTenantId(TENANT_A);
        try {
            siteA = siteService.create(SiteDto.builder().name("A Site").build()).getId();
        } finally {
            TenantContext.clear();
        }

        // Tenant B cannot hang a zone off tenant A's site — RLS makes it read as absent.
        TenantContext.setTenantId(TENANT_B);
        try {
            UUID crossSite = siteA;
            assertThatThrownBy(() -> zoneService.create(ZoneDto.builder().siteId(crossSite).name("Sneaky").build()))
                    .isInstanceOf(ResourceNotFoundException.class);
        } finally {
            TenantContext.clear();
        }
    }

    private void seedTenant(UUID id, String slug) {
        // Starter plan (max_sites=3) so multi-site camera isolation cases can run.
        // Clear prior rows for this fixed tenant id — the shared Testcontainer DB
        // retains data across methods in this class.
        jdbc.update("DELETE FROM camera WHERE tenant_id = ?", id);
        jdbc.update("DELETE FROM zone WHERE tenant_id = ?", id);
        jdbc.update("DELETE FROM site WHERE tenant_id = ?", id);
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status, plan_id)
                VALUES (?, ?, ?, 'active', '10000000-0000-0000-0000-000000000002')
                ON CONFLICT (id) DO UPDATE SET plan_id = EXCLUDED.plan_id
                """, id, slug, slug);
    }
}
