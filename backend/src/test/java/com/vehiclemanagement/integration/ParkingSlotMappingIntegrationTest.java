package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.parking.ParkingSlotMappingRequest;
import com.vehiclemanagement.parking.ParkingSlotMappingResult;
import com.vehiclemanagement.parking.ParkingSlotMappingService;
import com.vehiclemanagement.parking.ParkingSlotMappingStatus;
import com.vehiclemanagement.parking.ParkingMapPoint;
import com.vehiclemanagement.parking.ParkingMapService;
import com.vehiclemanagement.parking.ParkingSlotUpsertRequest;
import com.vehiclemanagement.parking.ParkingSlotView;
import com.vehiclemanagement.parking.SlotOccupancyObservation;
import com.vehiclemanagement.parking.SlotOccupancyService;
import com.vehiclemanagement.parking.SlotOccupancyTransition;
import com.vehiclemanagement.parking.SlotOccupancyView;
import com.vehiclemanagement.repository.PlateSearchReadRepository;
import com.vehiclemanagement.repository.EventTimelineReadRepository;
import com.vehiclemanagement.repository.AverageDwellReadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.UUID;
import java.util.List;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

/** DAI-298 authoritative PostGIS parking-slot point mapper. */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class ParkingSlotMappingIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000298aa");

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ParkingSlotMappingService mappingService;

    @Autowired
    ParkingMapService parkingMapService;

    @Autowired
    SlotOccupancyService occupancyService;

    @Autowired
    PlateSearchReadRepository plateSearchReadRepository;

    @Autowired
    EventTimelineReadRepository eventTimelineReadRepository;

    @Autowired
    AverageDwellReadRepository averageDwellReadRepository;

    private UUID siteId;
    private UUID zoneOneId;
    private UUID zoneTwoId;
    private UUID publishedMapId;
    private UUID slotA;
    private UUID slotB;
    private UUID slotC;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT);
        siteId = UUID.randomUUID();
        zoneOneId = UUID.randomUUID();
        zoneTwoId = UUID.randomUUID();
        publishedMapId = UUID.randomUUID();
        slotA = UUID.randomUUID();
        slotB = UUID.randomUUID();
        slotC = UUID.randomUUID();

        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status, plan_id)
                VALUES (?, 'Slot mapper tenant', ?, 'active',
                        '10000000-0000-0000-0000-000000000002')
                ON CONFLICT (id) DO NOTHING
                """, TENANT, "slot-mapper-" + UUID.randomUUID());
        jdbc.update("INSERT INTO site(id, tenant_id, name) VALUES (?, ?, ?)",
                siteId, TENANT, "Slot mapper site " + siteId);
        jdbc.update("INSERT INTO zone(id, tenant_id, site_id, name) VALUES (?, ?, ?, 'Zone one')",
                zoneOneId, TENANT, siteId);
        jdbc.update("INSERT INTO zone(id, tenant_id, site_id, name) VALUES (?, ?, ?, 'Zone two')",
                zoneTwoId, TENANT, siteId);
        jdbc.update("""
                INSERT INTO site_map_version(id, tenant_id, site_id, version_number, status, published_at)
                VALUES (?, ?, ?, 1, 'published', CURRENT_TIMESTAMP)
                """, publishedMapId, TENANT, siteId);

        insertSlot(slotA, zoneOneId, "A01", "POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))");
        insertSlot(slotB, zoneOneId, "A02", "POLYGON((2 0, 4 0, 4 2, 2 2, 2 0))");
        insertSlot(slotC, zoneTwoId, "B01", "POLYGON((10 10, 12 10, 12 12, 10 12, 10 10))");
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void mapsInteriorPointsAndHonoursAnOptionalZoneConstraint() {
        ParkingSlotMappingResult first = mappingService.map(
                new ParkingSlotMappingRequest(siteId, null, 1, 1, null));
        ParkingSlotMappingResult second = mappingService.map(
                new ParkingSlotMappingRequest(siteId, zoneTwoId, 11, 11, null));

        assertThat(first.status()).isEqualTo(ParkingSlotMappingStatus.MATCHED);
        assertThat(first.match().slotId()).isEqualTo(slotA);
        assertThat(second.status()).isEqualTo(ParkingSlotMappingStatus.MATCHED);
        assertThat(second.match().slotId()).isEqualTo(slotC);
    }

    @Test
    void returnsNoSlotWhenThePointIsOutsideEveryPublishedPolygon() {
        ParkingSlotMappingResult result = mappingService.map(
                new ParkingSlotMappingRequest(siteId, null, 6, 6, null));

        assertThat(result.status()).isEqualTo(ParkingSlotMappingStatus.NO_SLOT);
        assertThat(result.candidates()).isEmpty();
    }

    @Test
    void treatsASharedBoundaryAsAmbiguousUntilTheCurrentSlotBreaksTheTie() {
        ParkingSlotMappingResult ambiguous = mappingService.map(
                new ParkingSlotMappingRequest(siteId, zoneOneId, 2, 1, null));
        ParkingSlotMappingResult retained = mappingService.map(
                new ParkingSlotMappingRequest(siteId, zoneOneId, 2, 1, slotB));

        assertThat(ambiguous.status()).isEqualTo(ParkingSlotMappingStatus.AMBIGUOUS);
        assertThat(ambiguous.candidates()).extracting(candidate -> candidate.slotId())
                .containsExactly(slotA, slotB);
        assertThat(retained.status()).isEqualTo(ParkingSlotMappingStatus.MATCHED);
        assertThat(retained.match().slotId()).isEqualTo(slotB);
    }

    @Test
    void excludesDisabledSlotsAndValidatesCoordinatesBeforeQueryingPostgis() {
        jdbc.update("UPDATE parking_slot SET admin_status = 'disabled' WHERE id = ?", slotA);

        ParkingSlotMappingResult disabled = mappingService.map(
                new ParkingSlotMappingRequest(siteId, null, 1, 1, null));

        assertThat(disabled.status()).isEqualTo(ParkingSlotMappingStatus.NO_SLOT);
        assertThatIllegalArgumentException().isThrownBy(() ->
                new ParkingSlotMappingRequest(siteId, null, Double.NaN, 1, null));
    }

    @Test
    void replacesAndReadsAPublishedMapWhileKeepingLogicalSlotIds() {
        List<ParkingSlotView> saved = parkingMapService.replace(siteId, List.of(
                new ParkingSlotUpsertRequest(slotA, zoneOneId, "A01", "enabled",
                        List.of(new ParkingMapPoint(20, 20), new ParkingMapPoint(22, 20),
                                new ParkingMapPoint(22, 22), new ParkingMapPoint(20, 22))),
                new ParkingSlotUpsertRequest(slotB, zoneOneId, "A02", "disabled",
                        List.of(new ParkingMapPoint(23, 20), new ParkingMapPoint(25, 20),
                                new ParkingMapPoint(25, 22), new ParkingMapPoint(23, 22)))));

        assertThat(saved).extracting(ParkingSlotView::id).containsExactly(slotA, slotB);
        assertThat(saved.get(0).polygon()).hasSize(4);
        assertThat(parkingMapService.list(siteId)).isEqualTo(saved);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM site_map_version WHERE site_id = ? AND status = 'published'",
                Integer.class, siteId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM site_map_version WHERE site_id = ? AND status = 'retired'",
                Integer.class, siteId)).isEqualTo(1);
    }

    @Test
    void rejectsMalformedOrOverlappingPolygonsBeforePublishing() {
        assertThatIllegalArgumentException().isThrownBy(() -> parkingMapService.replace(siteId, List.of(
                new ParkingSlotUpsertRequest(null, zoneOneId, "X01", "enabled",
                        List.of(new ParkingMapPoint(0, 0), new ParkingMapPoint(2, 2),
                                new ParkingMapPoint(2, 0), new ParkingMapPoint(0, 2))))))
                .withMessageContaining("simple, valid");

        assertThatIllegalArgumentException().isThrownBy(() -> parkingMapService.replace(siteId, List.of(
                new ParkingSlotUpsertRequest(null, zoneOneId, "X01", "enabled",
                        List.of(new ParkingMapPoint(20, 20), new ParkingMapPoint(23, 20),
                                new ParkingMapPoint(23, 23), new ParkingMapPoint(20, 23))),
                new ParkingSlotUpsertRequest(null, zoneOneId, "X02", "enabled",
                        List.of(new ParkingMapPoint(21, 21), new ParkingMapPoint(24, 21),
                                new ParkingMapPoint(24, 24), new ParkingMapPoint(21, 24))))))
                .withMessageContaining("must not overlap");
    }

    @Test
    void appliesIdempotentEnterStayExitAndStaleTrackTransitions() {
        OffsetDateTime enteredAt = OffsetDateTime.parse("2026-07-14T00:00:00Z");
        SlotOccupancyView entered = occupancyService.process(new SlotOccupancyObservation(
                slotA, siteId, zoneOneId, "track-1", "30A-12345", enteredAt, SlotOccupancyTransition.ENTER));
        SlotOccupancyView replay = occupancyService.process(new SlotOccupancyObservation(
                slotA, siteId, zoneOneId, "track-1", "30A-12345", enteredAt, SlotOccupancyTransition.STAY));
        SlotOccupancyView conflict = occupancyService.process(new SlotOccupancyObservation(
                slotA, siteId, zoneOneId, "track-2", "30A-99999", enteredAt.plusSeconds(1), SlotOccupancyTransition.ENTER));
        SlotOccupancyView staleExit = occupancyService.process(new SlotOccupancyObservation(
                slotA, siteId, zoneOneId, "track-1", null, enteredAt.minusSeconds(1), SlotOccupancyTransition.STALE));
        SlotOccupancyView exited = occupancyService.process(new SlotOccupancyObservation(
                slotA, siteId, zoneOneId, "track-1", null, enteredAt.plusSeconds(2), SlotOccupancyTransition.EXIT));

        assertThat(entered.status()).isEqualTo("occupied");
        assertThat(replay.lastSeenAt()).isEqualTo(enteredAt);
        assertThat(conflict.trackId()).isEqualTo("track-1");
        assertThat(staleExit.status()).isEqualTo("occupied");
        assertThat(exited.status()).isEqualTo("free");
        assertThat(occupancyService.list(siteId, zoneOneId)).containsExactly(exited);
    }

    @Test
    void relocatesTheSameTrackOnceAndQueuesAnEventWithLinkedSnapshots() {
        OffsetDateTime enteredAt = OffsetDateTime.parse("2026-07-14T00:00:00Z");
        occupancyService.process(new SlotOccupancyObservation(slotA, siteId, zoneOneId, "track-relocate",
                "30A-12345", enteredAt, SlotOccupancyTransition.ENTER, UUID.randomUUID(), "old-frame-key"));

        SlotOccupancyView relocated = occupancyService.process(new SlotOccupancyObservation(slotB, siteId, zoneOneId,
                "track-relocate", null, enteredAt.plusSeconds(2), SlotOccupancyTransition.ENTER,
                UUID.randomUUID(), "new-frame-key"));
        occupancyService.process(new SlotOccupancyObservation(slotB, siteId, zoneOneId, "track-relocate",
                "30A-12345", enteredAt.plusSeconds(2), SlotOccupancyTransition.STAY));

        assertThat(occupancyService.list(siteId, zoneOneId))
                .extracting(SlotOccupancyView::status, SlotOccupancyView::trackId)
                .containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple("free", null),
                        org.assertj.core.groups.Tuple.tuple("occupied", "track-relocate"));
        assertThat(relocated.slotId()).isEqualTo(slotB);
        assertThat(relocated.plate()).isEqualTo("30A-12345");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM parking_event WHERE site_id = ? AND event_type = 'VehicleRelocated'",
                Integer.class, siteId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT count(*)
                  FROM outbox_message outbox
                  JOIN parking_event event ON event.id = outbox.event_id
                 WHERE outbox.status = 'pending' AND event.site_id = ?
                """, Integer.class, siteId)).isEqualTo(2);
        assertThat(jdbc.queryForList("""
                SELECT snapshot.kind, snapshot.snapshot_reference
                 FROM parking_event_snapshot snapshot
                  JOIN parking_event event ON event.id=snapshot.event_id
                 WHERE event.event_type='VehicleRelocated'
                   AND event.site_id = ?
                 ORDER BY snapshot.kind
                """, siteId))
                .containsExactly(
                        java.util.Map.of("kind", "relocation_new", "snapshot_reference", "new-frame-key"),
                        java.util.Map.of("kind", "relocation_old", "snapshot_reference", "old-frame-key"));
    }

    @Test
    void plateReadModelReturnsCurrentSlotThenDurableLastSeenAfterExit() {
        OffsetDateTime enteredAt = OffsetDateTime.parse("2026-07-14T01:00:00Z");
        OffsetDateTime exitedAt = enteredAt.plusMinutes(20);
        jdbc.update("""
                INSERT INTO vehicle_log(id, tenant_id, site_id, license_plate_number, type,
                                        vehicle_type, entry_exit_time, image_path)
                VALUES (?, ?, ?, '51A-123.45', 'entry', 'external', ?, '/uploads/snapshots/old-entry.jpg')
                """, UUID.randomUUID(), TENANT, siteId, enteredAt.minusMinutes(5));
        occupancyService.process(new SlotOccupancyObservation(slotA, siteId, zoneOneId,
                "plate-read-track", "51A-123.45", enteredAt, SlotOccupancyTransition.ENTER,
                UUID.randomUUID(), "/uploads/snapshots/occupancy.jpg"));

        var parked = plateSearchReadRepository.search(siteId, "51A12345", 20).get(0);
        assertThat(parked.currentSlotId()).isEqualTo(slotA);
        assertThat(parked.currentSlotCode()).isEqualTo("A01");
        assertThat(parked.currentZoneId()).isEqualTo(zoneOneId);
        assertThat(parked.lastSeenAt()).isEqualTo(enteredAt);
        assertThat(parked.snapshotUrl()).isEqualTo("/uploads/snapshots/occupancy.jpg");

        occupancyService.process(new SlotOccupancyObservation(slotA, siteId, zoneOneId,
                "plate-read-track", null, exitedAt, SlotOccupancyTransition.EXIT));
        jdbc.update("""
                INSERT INTO vehicle_log(id, tenant_id, site_id, license_plate_number, type,
                                        vehicle_type, entry_exit_time, image_path)
                VALUES (?, ?, ?, '51A-123.45', 'exit', 'external', ?, '/uploads/snapshots/exit.jpg')
                """, UUID.randomUUID(), TENANT, siteId, exitedAt);

        var exited = plateSearchReadRepository.search(siteId, "51A12345", 20).get(0);
        assertThat(exited.currentSlotId()).isNull();
        assertThat(exited.lastSeenAt()).isEqualTo(exitedAt);
        assertThat(exited.lastEventType()).isEqualTo("exit");
        assertThat(exited.snapshotUrl()).isEqualTo("/uploads/snapshots/exit.jpg");
    }

    @Test
    void eventTimelineUnifiesGateRelocationAndCameraEventsWithServerFilters() {
        OffsetDateTime base = OffsetDateTime.parse("2026-07-14T02:00:00Z");
        UUID cameraId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO camera(id, tenant_id, site_id, zone_id, name, role, status)
                VALUES (?, ?, ?, ?, 'Timeline camera', 'OVERVIEW', 'online')
                """, cameraId, TENANT, siteId, zoneOneId);
        jdbc.update("""
                INSERT INTO camera_ingest_event(id, tenant_id, camera_id, event_id, event_type,
                                                occurred_at, payload, snapshot_path)
                VALUES (?, ?, ?, 'motion-1', 'MOTION_DETECTED', ?, '{}', '/uploads/snapshots/motion.jpg')
                """, UUID.randomUUID(), TENANT, cameraId, base.plusMinutes(3));
        jdbc.update("""
                INSERT INTO vehicle_log(id, tenant_id, site_id, license_plate_number, type,
                                        vehicle_type, entry_exit_time, image_path)
                VALUES (?, ?, ?, '30A-111.11', 'entry', 'external', ?, '/uploads/snapshots/entry.jpg')
                """, UUID.randomUUID(), TENANT, siteId, base);
        occupancyService.process(new SlotOccupancyObservation(slotA, siteId, zoneOneId,
                "timeline-track", "30A-111.11", base.plusMinutes(1), SlotOccupancyTransition.ENTER,
                UUID.randomUUID(), "/uploads/snapshots/old-slot.jpg"));
        occupancyService.process(new SlotOccupancyObservation(slotB, siteId, zoneOneId,
                "timeline-track", "30A-111.11", base.plusMinutes(2), SlotOccupancyTransition.ENTER,
                UUID.randomUUID(), "/uploads/snapshots/new-slot.jpg"));

        var page = eventTimelineReadRepository.find(siteId, null, null, 0, 2);
        assertThat(page.totalElements()).isEqualTo(4);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.content()).extracting(item -> item.type())
                .containsExactly("MOTION_DETECTED", "VEHICLE_RELOCATED");
        assertThat(page.content().get(0).cameraId()).isEqualTo(cameraId);
        assertThat(page.content().get(0).zoneId()).isEqualTo(zoneOneId);
        assertThat(page.content().get(0).snapshotUrl()).isEqualTo("/uploads/snapshots/motion.jpg");
        assertThat(page.content().get(1).slotId()).isEqualTo(slotB);
        assertThat(page.content().get(1).plate()).isEqualTo("30A-111.11");
        assertThat(page.content().get(1).snapshotUrl()).isEqualTo("/uploads/snapshots/new-slot.jpg");

        var filtered = eventTimelineReadRepository.find(siteId, zoneOneId, "VEHICLE_RELOCATED", 0, 50);
        assertThat(filtered.content()).hasSize(1);
        assertThat(filtered.content().get(0).version()).isEqualTo(2L);
    }

    @Test
    void averageDwellUsesOnlyValidCompletedSessionsInSiteAndRange() {
        OffsetDateTime from = OffsetDateTime.parse("2026-07-07T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-07-14T00:00:00Z");
        insertParkingSession("CLOSED", from.plusDays(1), from.plusDays(1).plusMinutes(30));
        insertParkingSession("CLOSED", from.plusDays(2), from.plusDays(2).plusMinutes(90));
        insertParkingSession("OPEN", from.plusDays(3), null);
        insertParkingSession("CLOSED", from.minusDays(2), from.minusDays(2).plusHours(10));
        jdbc.update("""
                INSERT INTO parking_session(id, tenant_id, site_id, license_plate, status, started_at, ended_at)
                VALUES (?, ?, ?, 'INVALID', 'CLOSED', ?, ?)
                """, UUID.randomUUID(), TENANT, siteId, from.plusDays(4), from.plusDays(4).minusMinutes(1));

        var result = averageDwellReadRepository.calculate(siteId, from, to);

        assertThat(result.completedSessions()).isEqualTo(2);
        assertThat(result.averageDwellSeconds()).isEqualTo(3600.0);
    }

    private void insertParkingSession(String status, OffsetDateTime startedAt, OffsetDateTime endedAt) {
        jdbc.update("""
                INSERT INTO parking_session(id, tenant_id, site_id, license_plate, status, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), TENANT, siteId, "30A-" + UUID.randomUUID().toString().substring(0, 8),
                status, startedAt, endedAt);
    }

    private void insertSlot(UUID slotId, UUID zoneId, String code, String polygon) {
        jdbc.update("""
                INSERT INTO parking_slot(id, tenant_id, site_id, zone_id, code)
                VALUES (?, ?, ?, ?, ?)
                """, slotId, TENANT, siteId, zoneId, code);
        jdbc.update("""
                INSERT INTO parking_slot_geometry(id, tenant_id, site_id, slot_id, map_version_id, polygon)
                VALUES (?, ?, ?, ?, ?, ST_GeomFromText(?, 0))
                """, UUID.randomUUID(), TENANT, siteId, slotId, publishedMapId, polygon);
    }
}
