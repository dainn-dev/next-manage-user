package com.vehiclemanagement.repository;

import com.vehiclemanagement.parking.ParkingSlotMappingCandidate;
import com.vehiclemanagement.parking.ParkingSlotMappingRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.List;

/** Executes the authoritative PostGIS lookup against the currently published map. */
@Repository
public class ParkingSlotMappingRepository {

    private static final String FIND_COVERING_SLOTS = """
            WITH observation AS (
                SELECT ST_SetSRID(
                    ST_MakePoint(CAST(:xMeters AS double precision), CAST(:yMeters AS double precision)),
                    0
                ) AS point
            )
            SELECT slot.id AS slot_id,
                   geometry.id AS slot_geometry_id,
                   geometry.map_version_id,
                   slot.zone_id,
                   slot.code
              FROM parking_slot_geometry geometry
              JOIN parking_slot slot ON slot.id = geometry.slot_id
              JOIN site_map_version map_version ON map_version.id = geometry.map_version_id
              CROSS JOIN observation
             WHERE geometry.site_id = :siteId
               AND slot.site_id = :siteId
               AND map_version.site_id = :siteId
               AND slot.admin_status = 'enabled'
               AND map_version.status = 'published'
               AND (CAST(:zoneId AS uuid) IS NULL OR slot.zone_id = CAST(:zoneId AS uuid))
               AND geometry.polygon && observation.point
               AND ST_Covers(geometry.polygon, observation.point)
             ORDER BY lower(slot.code), slot.id
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public ParkingSlotMappingRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ParkingSlotMappingCandidate> findCoveringSlots(ParkingSlotMappingRequest request) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("siteId", request.siteId(), Types.OTHER)
                .addValue("zoneId", request.zoneId(), Types.OTHER)
                .addValue("xMeters", request.xMeters())
                .addValue("yMeters", request.yMeters());
        return jdbc.query(FIND_COVERING_SLOTS, parameters, (resultSet, rowNum) ->
                new ParkingSlotMappingCandidate(
                        resultSet.getObject("slot_id", java.util.UUID.class),
                        resultSet.getObject("slot_geometry_id", java.util.UUID.class),
                        resultSet.getObject("map_version_id", java.util.UUID.class),
                        resultSet.getObject("zone_id", java.util.UUID.class),
                        resultSet.getString("code")));
    }
}
