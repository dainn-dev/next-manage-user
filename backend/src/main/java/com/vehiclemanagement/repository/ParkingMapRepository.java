package com.vehiclemanagement.repository;

import com.vehiclemanagement.parking.ParkingMapPoint;
import com.vehiclemanagement.parking.ParkingSlotView;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.util.List;
import java.util.UUID;

/** Persistence operations for designer-authored, versioned parking maps. */
@Repository
public class ParkingMapRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public ParkingMapRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<ParkingSlotView> listPublished(UUID siteId) {
        return jdbc.query("""
                SELECT slot.id, slot.zone_id, slot.code, slot.admin_status,
                       ST_X(point) AS x, ST_Y(point) AS y
                  FROM site_map_version map
                  JOIN parking_slot_geometry geometry ON geometry.map_version_id = map.id
                  JOIN parking_slot slot ON slot.id = geometry.slot_id
                  CROSS JOIN LATERAL ST_DumpPoints(geometry.polygon) dumped
                  CROSS JOIN LATERAL (SELECT dumped.geom AS point) point_row
                 WHERE map.site_id = :siteId AND map.status = 'published'
                 ORDER BY lower(slot.code), slot.id, dumped.path
                """, params(siteId), resultSet -> {
            java.util.Map<UUID, List<ParkingMapPoint>> vertices = new java.util.LinkedHashMap<>();
            java.util.Map<UUID, Object[]> slots = new java.util.LinkedHashMap<>();
            while (resultSet.next()) {
                UUID id = resultSet.getObject("id", UUID.class);
                vertices.computeIfAbsent(id, ignored -> new java.util.ArrayList<>())
                        .add(new ParkingMapPoint(resultSet.getDouble("x"), resultSet.getDouble("y")));
                slots.putIfAbsent(id, new Object[]{resultSet.getObject("zone_id", UUID.class),
                        resultSet.getString("code"), resultSet.getString("admin_status")});
            }
            return vertices.entrySet().stream().map(entry -> {
                Object[] slot = slots.get(entry.getKey());
                // ST_DumpPoints repeats the closing vertex; the API returns the editor form.
                List<ParkingMapPoint> points = new java.util.ArrayList<>(entry.getValue());
                if (points.size() > 1 && points.getFirst().equals(points.getLast())) points.removeLast();
                return new ParkingSlotView(entry.getKey(), (UUID) slot[0], (String) slot[1], (String) slot[2], points);
            }).toList();
        });
    }

    public int nextVersion(UUID siteId) {
        Integer version = jdbc.queryForObject("SELECT COALESCE(MAX(version_number), 0) + 1 FROM site_map_version WHERE site_id = :siteId",
                params(siteId), Integer.class);
        return version == null ? 1 : version;
    }

    public UUID createPublishedVersion(UUID siteId, int version) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO site_map_version(id, site_id, version_number, status, published_at)
                VALUES (:id, :siteId, :version, 'published', CURRENT_TIMESTAMP)
                """, params(siteId).addValue("id", id, Types.OTHER).addValue("version", version));
        return id;
    }

    public void retirePublishedVersion(UUID siteId) {
        jdbc.update("UPDATE site_map_version SET status = 'retired' WHERE site_id = :siteId AND status = 'published'", params(siteId));
    }

    public boolean slotExistsAtSite(UUID slotId, UUID siteId) {
        Boolean exists = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM parking_slot WHERE id=:id AND site_id=:siteId)",
                params(siteId).addValue("id", slotId, Types.OTHER), Boolean.class);
        return Boolean.TRUE.equals(exists);
    }

    public void saveSlot(UUID slotId, UUID siteId, UUID zoneId, String code, String status) {
        jdbc.update("""
                INSERT INTO parking_slot(id, site_id, zone_id, code, admin_status)
                VALUES (:id, :siteId, :zoneId, :code, :status)
                ON CONFLICT (id) DO UPDATE SET zone_id=EXCLUDED.zone_id, code=EXCLUDED.code,
                    admin_status=EXCLUDED.admin_status
                """, params(siteId).addValue("id", slotId, Types.OTHER).addValue("zoneId", zoneId, Types.OTHER)
                .addValue("code", code).addValue("status", status));
    }

    public void saveGeometry(UUID slotId, UUID siteId, UUID mapVersionId, String polygonWkt) {
        jdbc.update("""
                INSERT INTO parking_slot_geometry(id, site_id, slot_id, map_version_id, polygon)
                VALUES (:id, :siteId, :slotId, :mapVersionId, ST_GeomFromText(:polygon, 0))
                """, params(siteId).addValue("id", UUID.randomUUID(), Types.OTHER).addValue("slotId", slotId, Types.OTHER)
                .addValue("mapVersionId", mapVersionId, Types.OTHER).addValue("polygon", polygonWkt));
    }

    public boolean zoneBelongsToSite(UUID zoneId, UUID siteId) {
        Boolean exists = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM zone WHERE id=:zoneId AND site_id=:siteId)",
                params(siteId).addValue("zoneId", zoneId, Types.OTHER), Boolean.class);
        return Boolean.TRUE.equals(exists);
    }

    public boolean isValidPolygon(String polygonWkt) {
        Boolean valid = jdbc.queryForObject("""
                SELECT ST_IsValid(polygon) AND ST_IsSimple(polygon) AND ST_Area(polygon) > 0
                FROM (SELECT ST_GeomFromText(:polygon, 0) polygon) candidate
                """, new MapSqlParameterSource("polygon", polygonWkt), Boolean.class);
        return Boolean.TRUE.equals(valid);
    }

    public boolean overlaps(String first, String second) {
        Boolean overlaps = jdbc.queryForObject("""
                SELECT ST_Area(ST_Intersection(ST_MakeValid(ST_GeomFromText(:first, 0)), ST_MakeValid(ST_GeomFromText(:second, 0)))) > 0.000001
                """, new MapSqlParameterSource().addValue("first", first).addValue("second", second), Boolean.class);
        return Boolean.TRUE.equals(overlaps);
    }

    private MapSqlParameterSource params(UUID siteId) {
        return new MapSqlParameterSource("siteId", siteId).addValue("siteId", siteId, Types.OTHER);
    }
}
