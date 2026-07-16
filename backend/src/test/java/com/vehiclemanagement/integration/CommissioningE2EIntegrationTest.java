package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.SiteDto;
import com.vehiclemanagement.dto.ZoneDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.parking.*;
import com.vehiclemanagement.service.CameraService;
import com.vehiclemanagement.service.ObjectStorageService;
import com.vehiclemanagement.service.SiteService;
import com.vehiclemanagement.service.ZoneService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/** DAI-329 repeatable Stage 4 commissioning acceptance against real PostGIS and RLS. */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class CommissioningE2EIntegrationTest extends AbstractPostgresIntegrationTest {

    @TestConfiguration
    static class RawCommissioningConfig {
        @Bean RawCommissioningGateway rawCommissioningGateway() { return new RawCommissioningGateway(); }
    }

    static class RawCommissioningGateway {
        @PersistenceContext EntityManager entityManager;

        @Transactional(readOnly = true)
        public List<String> tenantIdsWithoutApplicationPredicate() {
            @SuppressWarnings("unchecked")
            List<String> ids = entityManager.createNativeQuery("""
                    SELECT CAST(tenant_id AS text) FROM parking_map_source_image
                    UNION ALL SELECT CAST(tenant_id AS text) FROM camera_calibration_version
                    UNION ALL SELECT CAST(tenant_id AS text) FROM site_map_version
                    UNION ALL SELECT CAST(tenant_id AS text) FROM parking_map_draft_slot
                    """).getResultList();
            return ids;
        }
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired SiteService siteService;
    @Autowired ZoneService zoneService;
    @Autowired CameraService cameraService;
    @Autowired ParkingMapContractService mapService;
    @Autowired ParkingMapCommissioningService calibrationService;
    @Autowired ParkingSlotMappingService mappingService;
    @Autowired SlotOccupancyService occupancyService;
    @Autowired RawCommissioningGateway rawCommissioning;

    @MockBean ObjectStorageService storage;

    private UUID tenantId;

    @BeforeEach
    void setUp() {
        tenantId = seedTenant("commissioning-e2e");
        TenantContext.setTenantId(tenantId);
        when(storage.storeParkingMapStill(any(UUID.class), any(UUID.class), any(UUID.class),
                any(byte[].class), anyString())).thenAnswer(invocation ->
                "test/parking-map-stills/" + invocation.getArgument(2) + ".png");
        when(storage.resolveReadUrl(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void happyPathPublishesA01A02MapsTracksRelocationAndRepublishesWithoutFalseRelocation() throws Exception {
        SiteDto site = site("Pilot site");
        ZoneDto zone = zone(site, "B1");
        CameraDto overview = camera(site, zone, "Overview B1", Camera.CameraRole.OVERVIEW);
        CameraDto anpr = camera(site, zone, "Entry ANPR", Camera.CameraRole.ANPR_GATE);

        var credential = cameraService.issueKey(overview.getId());
        assertThat(credential.getIngestKey()).isNotBlank();
        assertThatThrownBy(() -> cameraService.issueKey(overview.getId()))
                .isInstanceOf(ConflictException.class).hasMessageContaining("already");
        assertThat(cameraService.heartbeat(overview.getId()).getStatus()).isEqualTo(Camera.CameraStatus.online);
        assertThat(anpr.getRole()).isEqualTo(Camera.CameraRole.ANPR_GATE);

        CalibratedCamera calibrated = calibrate(site, overview, 0);
        List<ParkingMapDraftSlotRequest> slots = List.of(
                slot(zone, "A01", 10, 10, 30, 30),
                slot(zone, "A02", 40, 10, 60, 30));
        ParkingMapDraftView firstDraft = draft(calibrated, fullCoverage(), slots);
        assertThat(mapService.validate(site.getId(), overview.getId(), firstDraft.id()).valid()).isTrue();
        ParkingMapDraftView firstPublished = mapService.publish(
                site.getId(), overview.getId(), firstDraft.id(), firstDraft.lockVersion(), "pilot-map-v1");
        assertThat(firstPublished.status()).isEqualTo("published");
        assertThat(mapService.publish(site.getId(), overview.getId(), firstDraft.id(), firstDraft.lockVersion(), "pilot-map-v1").id())
                .isEqualTo(firstPublished.id());

        var a01 = mappingService.map(new ParkingSlotMappingRequest(site.getId(), zone.getId(), 2, 2, null));
        var a02 = mappingService.map(new ParkingSlotMappingRequest(site.getId(), zone.getId(), 5, 2, null));
        assertThat(a01.status()).isEqualTo(ParkingSlotMappingStatus.MATCHED);
        assertThat(a01.match().slotCode()).isEqualTo("A01");
        assertThat(a02.match().slotCode()).isEqualTo("A02");

        OffsetDateTime enteredAt = OffsetDateTime.parse("2026-07-16T00:00:00Z");
        occupancyService.process(new SlotOccupancyObservation(a01.match().slotId(), site.getId(), zone.getId(),
                "pilot-track", "51A-12345", enteredAt, SlotOccupancyTransition.ENTER,
                UUID.randomUUID(), "evidence/a01-enter.png"));

        // Redrawing with null slot IDs must resolve the existing logical slots by site-wide code.
        ParkingMapDraftView secondDraft = draft(calibrated, fullCoverage(), slots);
        ParkingMapDraftView secondPublished = mapService.publish(
                site.getId(), overview.getId(), secondDraft.id(), secondDraft.lockVersion(), "pilot-map-v2");
        assertThat(secondPublished.versionNumber()).isEqualTo(2);
        assertThat(mapService.get(site.getId(), overview.getId(), firstPublished.id()).status())
                .isEqualTo("archived");
        var a01AfterRepublish = mappingService.map(
                new ParkingSlotMappingRequest(site.getId(), zone.getId(), 2, 2, null));
        assertThat(a01AfterRepublish.match().slotId()).isEqualTo(a01.match().slotId());
        assertThat(occupancyService.list(site.getId(), zone.getId()))
                .anySatisfy(item -> {
                    assertThat(item.slotId()).isEqualTo(a01.match().slotId());
                    assertThat(item.status()).isEqualTo("occupied");
                });
        assertThat(eventCount(site.getId(), "VehicleRelocated")).isZero();

        occupancyService.process(new SlotOccupancyObservation(a02.match().slotId(), site.getId(), zone.getId(),
                "pilot-track", null, enteredAt.plusSeconds(2), SlotOccupancyTransition.ENTER,
                UUID.randomUUID(), "evidence/a02-relocate.png"));
        occupancyService.process(new SlotOccupancyObservation(a02.match().slotId(), site.getId(), zone.getId(),
                "pilot-track", null, enteredAt.plusSeconds(4), SlotOccupancyTransition.EXIT,
                UUID.randomUUID(), "evidence/a02-exit.png"));

        assertThat(eventCount(site.getId(), "VehicleRelocated")).isEqualTo(1);
        assertThat(occupancyService.list(site.getId(), zone.getId()))
                .filteredOn(item -> item.slotId().equals(a02.match().slotId()))
                .extracting(SlotOccupancyView::status).containsExactly("free");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM parking_map_activation_audit WHERE site_id=? AND action='publish'",
                Integer.class, site.getId())).isEqualTo(2);
    }

    @Test
    void rejectsCrossSiteInvalidDuplicateOverlappingAndStaleInputs() throws Exception {
        SiteDto site = site("Negative site");
        ZoneDto zone = zone(site, "Valid zone");
        CameraDto overview = camera(site, zone, "Negative overview", Camera.CameraRole.OVERVIEW);
        CalibratedCamera calibrated = calibrate(site, overview, 0);

        SiteDto otherSite = site("Other site");
        ZoneDto otherZone = zone(otherSite, "Foreign zone");
        CameraDto foreignCamera = camera(otherSite, otherZone, "Foreign overview", Camera.CameraRole.OVERVIEW);

        assertThatThrownBy(() -> draft(calibrated, fullCoverage(), List.of(
                slot(otherZone, "X01", 10, 10, 30, 30))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Zone");
        assertThatThrownBy(() -> mapService.create(site.getId(), foreignCamera.getId(), request(
                calibrated, fullCoverage(), List.of(slot(zone, "X01", 10, 10, 30, 30)))))
                .isInstanceOf(ResourceNotFoundException.class);
        ParkingMapDraftView scopedDraft = draft(calibrated, fullCoverage(), List.of(
                slot(zone, "SCOPE", 10, 10, 30, 30)));
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE parking_map_draft_slot SET zone_id=? WHERE map_version_id=?",
                otherZone.getId(), scopedDraft.id()))
                .isInstanceOf(DataIntegrityViolationException.class);
        mapService.delete(site.getId(), overview.getId(), scopedDraft.id(), scopedDraft.lockVersion());
        assertThatThrownBy(() -> draft(calibrated, fullCoverage(), List.of(
                new ParkingMapDraftSlotRequest(null, zone.getId(), "X01", "enabled", List.of(
                        new ParkingMapPoint(0, 0), new ParkingMapPoint(101, 0), new ParkingMapPoint(0, 20))))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("bounds");
        assertThatThrownBy(() -> draft(calibrated, fullCoverage(), List.of(
                slot(zone, "DUP", 10, 10, 20, 20), slot(zone, "dup", 30, 10, 40, 20))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("unique");

        ParkingMapDraftView selfIntersecting = draft(calibrated, fullCoverage(), List.of(
                new ParkingMapDraftSlotRequest(null, zone.getId(), "BOW", "enabled", List.of(
                        new ParkingMapPoint(10, 10), new ParkingMapPoint(30, 30),
                        new ParkingMapPoint(30, 10), new ParkingMapPoint(10, 30)))));
        assertThat(mapService.validate(site.getId(), overview.getId(), selfIntersecting.id()).errors())
                .anyMatch(error -> error.contains("invalid"));
        mapService.delete(site.getId(), overview.getId(), selfIntersecting.id(), selfIntersecting.lockVersion());

        ParkingMapDraftView overlapping = draft(calibrated, fullCoverage(), List.of(
                slot(zone, "O01", 10, 10, 40, 40), slot(zone, "O02", 20, 20, 50, 50)));
        assertThat(mapService.validate(site.getId(), overview.getId(), overlapping.id()).errors())
                .anyMatch(error -> error.contains("overlap"));
        mapService.delete(site.getId(), overview.getId(), overlapping.id(), overlapping.lockVersion());

        ParkingMapDraftView outsideCoverage = draft(calibrated, List.of(
                new ParkingMapPoint(0, 0), new ParkingMapPoint(50, 0),
                new ParkingMapPoint(50, 50), new ParkingMapPoint(0, 50)), List.of(
                slot(zone, "OUT", 40, 40, 60, 60)));
        assertThat(mapService.validate(site.getId(), overview.getId(), outsideCoverage.id()).errors())
                .anyMatch(error -> error.contains("outside its camera coverage"));
        mapService.delete(site.getId(), overview.getId(), outsideCoverage.id(), outsideCoverage.lockVersion());

        ParkingMapDraftView stale = draft(calibrated, fullCoverage(), List.of(
                slot(zone, "S01", 10, 10, 30, 30)));
        jdbc.update("UPDATE camera_calibration_version SET status='stale' WHERE id=?", calibrated.calibration().id());
        assertThat(mapService.validate(site.getId(), overview.getId(), stale.id()).errors())
                .anyMatch(error -> error.contains("stale"));
        assertThatThrownBy(() -> mapService.publish(site.getId(), overview.getId(), stale.id(), stale.lockVersion(), "stale-map"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("stale");
    }

    @Test
    void twoOverviewCamerasPublishDisjointPartitionsIntoOneSiteLayout() throws Exception {
        SiteDto site = site("Multi-camera site");
        ZoneDto zone = zone(site, "Unified zone");
        CameraDto left = camera(site, zone, "Overview left", Camera.CameraRole.OVERVIEW);
        CameraDto right = camera(site, zone, "Overview right", Camera.CameraRole.OVERVIEW);
        CalibratedCamera leftCal = calibrate(site, left, 0);
        CalibratedCamera overlappingRightCal = calibrate(site, right, 0);

        ParkingMapDraftView leftMap = draft(leftCal, fullCoverage(), List.of(
                slot(zone, "L01", 10, 10, 30, 30)));
        mapService.publish(site.getId(), left.getId(), leftMap.id(), leftMap.lockVersion(), "left-partition");
        UUID leftSlotId = mappingService.map(
                new ParkingSlotMappingRequest(site.getId(), null, 2, 2, null)).match().slotId();

        ParkingMapDraftView invalidRight = draft(overlappingRightCal, fullCoverage(), List.of(
                slot(zone, "L01", 10, 10, 30, 30)));
        ParkingMapValidationView overlap = mapService.validate(site.getId(), right.getId(), invalidRight.id());
        assertThat(overlap.valid()).isFalse();
        assertThat(overlap.errors()).anyMatch(error -> error.contains("another camera partition"));
        mapService.delete(site.getId(), right.getId(), invalidRight.id(), invalidRight.lockVersion());

        CalibratedCamera rightCal = calibrate(site, right, 10);
        assertThatThrownBy(() -> draft(rightCal, fullCoverage(), List.of(
                new ParkingMapDraftSlotRequest(leftSlotId, zone.getId(), "R00", "enabled", List.of(
                        new ParkingMapPoint(10, 10), new ParkingMapPoint(20, 10),
                        new ParkingMapPoint(20, 20), new ParkingMapPoint(10, 20))))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("camera partition");
        ParkingMapDraftView rightMap = draft(rightCal, fullCoverage(), List.of(
                slot(zone, "R01", 10, 10, 30, 30)));
        assertThat(mapService.validate(site.getId(), right.getId(), rightMap.id()).valid()).isTrue();
        mapService.publish(site.getId(), right.getId(), rightMap.id(), rightMap.lockVersion(), "right-partition");

        assertThat(mappingService.map(new ParkingSlotMappingRequest(site.getId(), null, 2, 2, null))
                .match().slotCode()).isEqualTo("L01");
        assertThat(mappingService.map(new ParkingSlotMappingRequest(site.getId(), null, 12, 2, null))
                .match().slotCode()).isEqualTo("R01");
        assertThat(jdbc.queryForObject("""
                SELECT count(DISTINCT slot.id)
                  FROM parking_slot slot
                  JOIN parking_slot_geometry geometry ON geometry.slot_id=slot.id
                  JOIN site_map_version map ON map.id=geometry.map_version_id
                 WHERE map.site_id=? AND map.status='published'
                """, Integer.class, site.getId())).isEqualTo(2);

        ParkingMapUnifiedPreviewView preview = mapService.unifiedPreview(site.getId());
        assertThat(preview.coordinateSpace()).isEqualTo("site-local-meters-v1");
        assertThat(preview.features()).extracting(ParkingMapUnifiedPreviewView.Feature::code)
                .containsExactly("L01", "R01");
        assertThat(preview.features()).allSatisfy(feature ->
                assertThat(feature.polygon()).allSatisfy(point ->
                        assertThat(point.x()).isBetween(0.0, 13.0)));
    }

    @Test
    void republishRetiresRemovedSlotAndRollbackRestoresArchivedGeometry() throws Exception {
        SiteDto site = site("Rollback site");
        ZoneDto zone = zone(site, "Rollback zone");
        CameraDto overview = camera(site, zone, "Rollback overview", Camera.CameraRole.OVERVIEW);
        CalibratedCamera calibrated = calibrate(site, overview, 0);

        ParkingMapDraftView v1Draft = draft(calibrated, fullCoverage(), List.of(
                slot(zone, "A01", 10, 10, 30, 30),
                slot(zone, "A02", 40, 10, 60, 30)));
        ParkingMapDraftView v1 = mapService.publish(site.getId(), overview.getId(), v1Draft.id(),
                v1Draft.lockVersion(), "rollback-v1");

        ParkingMapDraftView v2Draft = draft(calibrated, fullCoverage(), List.of(
                slot(zone, "A01", 12, 12, 32, 32)));
        ParkingMapDraftView v2 = mapService.publish(site.getId(), overview.getId(), v2Draft.id(),
                v2Draft.lockVersion(), "rollback-v2");

        assertThat(jdbc.queryForObject("SELECT admin_status FROM parking_slot WHERE site_id=? AND code='A02'",
                String.class, site.getId())).isEqualTo("retired");
        assertThat(mapService.unifiedPreview(site.getId()).features())
                .extracting(ParkingMapUnifiedPreviewView.Feature::code).containsExactly("A01");

        ParkingMapDraftView archivedV1 = mapService.get(site.getId(), overview.getId(), v1.id());
        ParkingMapDraftView restored = mapService.rollback(site.getId(), overview.getId(), archivedV1.id(),
                archivedV1.lockVersion(), "restore removed A02");

        assertThat(restored.status()).isEqualTo("published");
        assertThat(mapService.get(site.getId(), overview.getId(), v2.id()).status()).isEqualTo("archived");
        assertThat(mapService.unifiedPreview(site.getId()).features())
                .extracting(ParkingMapUnifiedPreviewView.Feature::code).containsExactly("A01", "A02");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM parking_map_activation_audit
                 WHERE site_id=? AND map_version_id=? AND action='rollback' AND reason='restore removed A02'
                """, Integer.class, site.getId(), v1.id())).isEqualTo(1);

        mapService.archive(site.getId(), overview.getId(), restored.id(), restored.lockVersion());
        assertThat(mapService.unifiedPreview(site.getId()).features()).isEmpty();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM parking_slot
                 WHERE site_id=? AND authoring_camera_id=? AND admin_status<>'retired'
                """, Integer.class, site.getId(), overview.getId())).isZero();
    }

    @Test
    void commissioningTablesAndServiceReadsAreIsolatedBetweenTwoTenants() throws Exception {
        SiteDto siteA = site("Tenant A site");
        ZoneDto zoneA = zone(siteA, "A zone");
        CameraDto cameraA = camera(siteA, zoneA, "A overview", Camera.CameraRole.OVERVIEW);
        CalibratedCamera calibratedA = calibrate(siteA, cameraA, 0);
        draft(calibratedA, fullCoverage(), List.of(slot(zoneA, "A01", 10, 10, 30, 30)));
        assertThat(distinct(rawCommissioning.tenantIdsWithoutApplicationPredicate()))
                .containsExactly(tenantId.toString());

        UUID tenantB = seedTenant("commissioning-tenant-b");
        TenantContext.setTenantId(tenantB);
        SiteDto siteB = site("Tenant B site");
        ZoneDto zoneB = zone(siteB, "B zone");
        CameraDto cameraB = camera(siteB, zoneB, "B overview", Camera.CameraRole.OVERVIEW);
        CalibratedCamera calibratedB = calibrate(siteB, cameraB, 20);
        draft(calibratedB, fullCoverage(), List.of(slot(zoneB, "B01", 10, 10, 30, 30)));

        assertThat(distinct(rawCommissioning.tenantIdsWithoutApplicationPredicate()))
                .containsExactly(tenantB.toString()).doesNotContain(tenantId.toString());
        assertThatThrownBy(() -> mapService.list(siteA.getId(), cameraA.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private SiteDto site(String name) {
        return siteService.create(SiteDto.builder().name(name).location("pilot").build());
    }

    private ZoneDto zone(SiteDto site, String name) {
        return zoneService.create(ZoneDto.builder().siteId(site.getId()).name(name).build());
    }

    private CameraDto camera(SiteDto site, ZoneDto zone, String name, Camera.CameraRole role) {
        return cameraService.create(CameraDto.builder().siteId(site.getId()).zoneId(zone.getId())
                .name(name).role(role).panelType(role == Camera.CameraRole.ANPR_GATE
                        ? Camera.PanelType.entry : null).build());
    }

    private CalibratedCamera calibrate(SiteDto site, CameraDto camera, double xOffset) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", camera.getId() + ".png",
                "image/png", png());
        ParkingMapSourceImageView image = mapService.upload(site.getId(), camera.getId(), file);
        CalibrationVersionView calibration = calibrationService.createCalibration(site.getId(),
                new CreateCalibrationRequest(camera.getId(), image.id(), List.of(
                        new CalibrationControlPoint(0, 0, xOffset, 0),
                        new CalibrationControlPoint(100, 0, xOffset + 10, 0),
                        new CalibrationControlPoint(100, 100, xOffset + 10, 10),
                        new CalibrationControlPoint(0, 100, xOffset, 10))));
        assertThat(calibration.reprojectionError()).isLessThan(1e-8);
        return new CalibratedCamera(site, camera, image, calibration);
    }

    private ParkingMapDraftView draft(CalibratedCamera calibrated, List<ParkingMapPoint> coverage,
                                      List<ParkingMapDraftSlotRequest> slots) {
        return mapService.create(calibrated.site().getId(), calibrated.camera().getId(),
                request(calibrated, coverage, slots));
    }

    private ParkingMapDraftRequest request(CalibratedCamera calibrated, List<ParkingMapPoint> coverage,
                                           List<ParkingMapDraftSlotRequest> slots) {
        return new ParkingMapDraftRequest(calibrated.image().id(), calibrated.calibration().id(), coverage, slots);
    }

    private ParkingMapDraftSlotRequest slot(ZoneDto zone, String code,
                                            double x1, double y1, double x2, double y2) {
        return new ParkingMapDraftSlotRequest(null, zone.getId(), code, "ACTIVE", List.of(
                new ParkingMapPoint(x1, y1), new ParkingMapPoint(x2, y1),
                new ParkingMapPoint(x2, y2), new ParkingMapPoint(x1, y2)));
    }

    private List<ParkingMapPoint> fullCoverage() {
        return List.of(new ParkingMapPoint(0, 0), new ParkingMapPoint(100, 0),
                new ParkingMapPoint(100, 100), new ParkingMapPoint(0, 100));
    }

    private int eventCount(UUID site, String type) {
        return jdbc.queryForObject("SELECT count(*) FROM parking_event WHERE site_id=? AND event_type=?",
                Integer.class, site, type);
    }

    private UUID seedTenant(String prefix) {
        UUID id = UUID.randomUUID();
        String slug = prefix + "-" + id.toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO tenant(id,name,slug,status,plan_id)
                VALUES (?, ?, ?, 'active', '10000000-0000-0000-0000-000000000002')
                """, id, slug, slug);
        return id;
    }

    private Set<String> distinct(List<String> values) {
        return values.stream().collect(Collectors.toSet());
    }

    private byte[] png() throws Exception {
        BufferedImage image = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(Color.DARK_GRAY);
        graphics.fillRect(0, 0, 100, 100);
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private record CalibratedCamera(SiteDto site, CameraDto camera, ParkingMapSourceImageView image,
                                    CalibrationVersionView calibration) { }
}
