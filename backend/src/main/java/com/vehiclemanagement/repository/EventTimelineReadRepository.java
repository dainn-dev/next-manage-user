package com.vehiclemanagement.repository;

import com.vehiclemanagement.dto.EventTimelineItemDto;
import com.vehiclemanagement.dto.EventTimelinePageDto;
import com.vehiclemanagement.service.ObjectStorageService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Site-scoped operational timeline assembled from durable gate, parking, and camera events. */
@Repository
public class EventTimelineReadRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectStorageService objectStorage;

    public EventTimelineReadRepository(NamedParameterJdbcTemplate jdbc, ObjectStorageService objectStorage) {
        this.jdbc = jdbc;
        this.objectStorage = objectStorage;
    }

    public EventTimelinePageDto find(UUID siteId, UUID zoneId, String type, int page, int size) {
        String normalizedType = type == null || type.isBlank() || "ALL".equalsIgnoreCase(type)
                ? null : type.trim().toUpperCase(Locale.ROOT);
        String sql = """
                WITH timeline AS (
                    SELECT 'gate:' || vl.id AS id, vl.site_id,
                           CASE vl.type::text WHEN 'entry' THEN 'VEHICLE_ENTERED' ELSE 'VEHICLE_EXITED' END AS type,
                           vl.entry_exit_time AS occurred_at, vl.license_plate_number AS plate,
                           NULL::uuid AS camera_id, NULL::uuid AS slot_id, NULL::uuid AS zone_id,
                           NULL::bigint AS version, vl.image_path AS snapshot_reference
                      FROM vehicle_log vl
                     WHERE vl.site_id = :siteId
                    UNION ALL
                    SELECT 'parking:' || pe.id, pe.site_id, 'VEHICLE_RELOCATED', pe.occurred_at,
                           pe.payload #>> '{payload,identity,license_plate}', NULL::uuid,
                           NULLIF(pe.payload #>> '{payload,new_slot_id}', '')::uuid,
                           NULLIF(pe.payload #>> '{payload,new_zone_id}', '')::uuid,
                           pe.transition_sequence, snap.snapshot_reference
                      FROM parking_event pe
                      LEFT JOIN LATERAL (
                          SELECT pes.snapshot_reference
                            FROM parking_event_snapshot pes
                           WHERE pes.event_id = pe.id
                           ORDER BY CASE pes.kind WHEN 'relocation_new' THEN 0 ELSE 1 END
                           LIMIT 1
                      ) snap ON true
                     WHERE pe.site_id = :siteId
                    UNION ALL
                    SELECT 'camera:' || cie.id, c.site_id,
                           CASE upper(cie.event_type)
                               WHEN 'MOTION' THEN 'MOTION_DETECTED'
                               WHEN 'MOTION_DETECTED' THEN 'MOTION_DETECTED'
                               ELSE upper(cie.event_type)
                           END,
                           COALESCE(cie.occurred_at, cie.received_at), NULL::varchar,
                           c.id, NULL::uuid, c.zone_id, NULL::bigint, cie.snapshot_path
                      FROM camera_ingest_event cie
                      JOIN camera c ON c.id = cie.camera_id
                     WHERE c.site_id = :siteId
                ), filtered AS (
                    SELECT *, count(*) OVER () AS total_count
                      FROM timeline
                     WHERE (CAST(:zoneId AS uuid) IS NULL OR zone_id = CAST(:zoneId AS uuid))
                       AND (CAST(:type AS varchar) IS NULL OR type = CAST(:type AS varchar))
                )
                SELECT * FROM filtered
                 ORDER BY occurred_at DESC, id DESC
                 LIMIT :size OFFSET :offset
                """;
        var params = new MapSqlParameterSource()
                .addValue("siteId", siteId, Types.OTHER)
                .addValue("zoneId", zoneId, Types.OTHER)
                .addValue("type", normalizedType)
                .addValue("size", size)
                .addValue("offset", page * size);
        final long[] total = {0};
        List<EventTimelineItemDto> content = jdbc.query(sql, params, (rs, row) -> {
            total[0] = rs.getLong("total_count");
            return new EventTimelineItemDto(rs.getString("id"), rs.getObject("site_id", UUID.class),
                    rs.getString("type"), rs.getObject("occurred_at", OffsetDateTime.class), rs.getString("plate"),
                    rs.getObject("camera_id", UUID.class), rs.getObject("slot_id", UUID.class),
                    rs.getObject("zone_id", UUID.class), rs.getObject("version", Long.class),
                    objectStorage.resolveReadUrl(rs.getString("snapshot_reference")));
        });
        return new EventTimelinePageDto(content, page, size, total[0], (long) (page + 1) * size < total[0]);
    }
}
