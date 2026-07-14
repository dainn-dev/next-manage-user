package com.vehiclemanagement.repository;

import com.vehiclemanagement.dto.PlateSearchResultDto;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.service.ObjectStorageService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Site-scoped union of registry, current occupancy, and durable gate history. */
@Repository
public class PlateSearchReadRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectStorageService objectStorageService;

    public PlateSearchReadRepository(NamedParameterJdbcTemplate jdbc, ObjectStorageService objectStorageService) {
        this.jdbc = jdbc;
        this.objectStorageService = objectStorageService;
    }

    public List<PlateSearchResultDto> search(UUID siteId, String normalizedPlate, int limit) {
        String normalized = "regexp_replace(upper(%s), '[^A-Z0-9]', '', 'g')";
        String sql = """
                WITH raw AS (
                    SELECT %s AS normalized_plate, v.license_plate AS plate, v.id AS vehicle_id, v.status AS vehicle_status
                      FROM vehicles v
                     WHERE v.current_site_id = :siteId AND %s LIKE concat('%%', :plate, '%%')
                    UNION ALL
                    SELECT %s, so.plate, NULL::uuid, NULL::varchar
                      FROM slot_occupancy so
                     WHERE so.site_id = :siteId AND so.status = 'occupied' AND so.plate IS NOT NULL
                       AND %s LIKE concat('%%', :plate, '%%')
                    UNION ALL
                    SELECT %s, vl.license_plate_number, vl.vehicle_id, NULL::varchar
                      FROM vehicle_log vl
                     WHERE vl.site_id = :siteId AND %s LIKE concat('%%', :plate, '%%')
                ), plates AS (
                    SELECT DISTINCT ON (normalized_plate) normalized_plate, plate, vehicle_id, vehicle_status
                      FROM raw
                     ORDER BY normalized_plate, vehicle_id NULLS LAST
                )
                SELECT p.normalized_plate, p.plate, p.vehicle_id, p.vehicle_status,
                       occ.slot_id, occ.slot_code, occ.zone_id, occ.last_seen_at AS occupancy_seen_at,
                       occ.snapshot_reference, occ.snapshot_seen_at,
                       history.entry_exit_time, history.event_type,
                       history_snapshot.image_path, history_snapshot.snapshot_time
                  FROM plates p
                  LEFT JOIN LATERAL (
                      SELECT so.slot_id, ps.code AS slot_code, so.zone_id, so.last_seen_at,
                             so.snapshot_reference, so.snapshot_seen_at
                        FROM slot_occupancy so
                        JOIN parking_slot ps ON ps.id = so.slot_id
                       WHERE so.site_id = :siteId AND so.status = 'occupied' AND so.plate IS NOT NULL
                         AND %s = p.normalized_plate
                       ORDER BY so.last_seen_at DESC
                       LIMIT 1
                  ) occ ON true
                  LEFT JOIN LATERAL (
                      SELECT vl.entry_exit_time, vl.type::text AS event_type
                        FROM vehicle_log vl
                       WHERE vl.site_id = :siteId AND %s = p.normalized_plate
                       ORDER BY vl.entry_exit_time DESC, vl.id DESC
                       LIMIT 1
                  ) history ON true
                  LEFT JOIN LATERAL (
                      SELECT vl.image_path, vl.entry_exit_time AS snapshot_time
                        FROM vehicle_log vl
                       WHERE vl.site_id = :siteId AND %s = p.normalized_plate
                         AND vl.image_path IS NOT NULL AND btrim(vl.image_path) <> ''
                       ORDER BY vl.entry_exit_time DESC, vl.id DESC
                       LIMIT 1
                  ) history_snapshot ON true
                 ORDER BY p.normalized_plate
                 LIMIT :limit
                """.formatted(
                normalized.formatted("v.license_plate"), normalized.formatted("v.license_plate"),
                normalized.formatted("so.plate"), normalized.formatted("so.plate"),
                normalized.formatted("vl.license_plate_number"), normalized.formatted("vl.license_plate_number"),
                normalized.formatted("so.plate"), normalized.formatted("vl.license_plate_number"),
                normalized.formatted("vl.license_plate_number"));
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("siteId", siteId, Types.OTHER)
                        .addValue("plate", normalizedPlate)
                        .addValue("limit", limit),
                (rs, row) -> {
                    UUID vehicleId = rs.getObject("vehicle_id", UUID.class);
                    String plate = rs.getString("plate");
                    OffsetDateTime occupancySeen = rs.getObject("occupancy_seen_at", OffsetDateTime.class);
                    OffsetDateTime eventSeen = rs.getObject("entry_exit_time", OffsetDateTime.class);
                    OffsetDateTime lastSeen = occupancySeen == null ? eventSeen : eventSeen == null
                            ? occupancySeen : occupancySeen.isAfter(eventSeen) ? occupancySeen : eventSeen;
                    String status = rs.getString("vehicle_status");
                    OffsetDateTime occupancySnapshotSeen = rs.getObject("snapshot_seen_at", OffsetDateTime.class);
                    OffsetDateTime historySnapshotSeen = rs.getObject("snapshot_time", OffsetDateTime.class);
                    String snapshotReference = rs.getString("image_path");
                    if (rs.getString("snapshot_reference") != null
                            && (historySnapshotSeen == null || occupancySnapshotSeen != null
                            && !occupancySnapshotSeen.isBefore(historySnapshotSeen))) {
                        snapshotReference = rs.getString("snapshot_reference");
                    }
                    return new PlateSearchResultDto(
                            vehicleId == null ? UUID.nameUUIDFromBytes((siteId + ":" + plate).getBytes(StandardCharsets.UTF_8)) : vehicleId,
                            plate, siteId, status == null ? null : Vehicle.VehicleStatus.valueOf(status),
                            rs.getObject("slot_id", UUID.class), rs.getString("slot_code"),
                            rs.getObject("zone_id", UUID.class), lastSeen, rs.getString("event_type"),
                            objectStorageService.resolveReadUrl(snapshotReference));
                });
    }
}
