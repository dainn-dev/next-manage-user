package com.vehiclemanagement.repository;

import com.vehiclemanagement.parking.SlotOccupancyView;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Types;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class SlotOccupancyRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public SlotOccupancyRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    /** Locks the destination and current same-track slot in UUID order to avoid relocation deadlocks. */
    public List<SlotOccupancyView> lockTransitionSlots(UUID targetSlotId, UUID siteId, String trackId) {
        return jdbc.query("""
                SELECT slot_id, site_id, zone_id, status, track_id, plate, last_seen_at, snapshot_reference
                  FROM slot_occupancy
                 WHERE slot_id = :targetSlotId
                    OR (site_id = :siteId AND track_id = :trackId AND status = 'occupied')
                 ORDER BY slot_id
                 FOR UPDATE
                """, new MapSqlParameterSource().addValue("targetSlotId", targetSlotId, Types.OTHER)
                        .addValue("siteId", siteId, Types.OTHER).addValue("trackId", trackId),
                (rs,n) -> view(rs));
    }
    public boolean slotBelongsToSite(UUID slotId, UUID siteId) {
        Boolean exists = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM parking_slot WHERE id=:slotId AND site_id=:siteId)",
                params(slotId).addValue("siteId", siteId, Types.OTHER), Boolean.class);
        return Boolean.TRUE.equals(exists);
    }
    /** Returns the current slot for one tracker identity inside its authenticated site. */
    public Optional<SlotOccupancyView> findOccupiedByTrack(UUID siteId, String trackId) {
        List<SlotOccupancyView> rows = jdbc.query("""
                SELECT slot_id, site_id, zone_id, status, track_id, plate, last_seen_at, snapshot_reference
                  FROM slot_occupancy
                 WHERE site_id = :siteId AND track_id = :trackId AND status = 'occupied'
                 LIMIT 1
                """, new MapSqlParameterSource().addValue("siteId", siteId, Types.OTHER)
                        .addValue("trackId", trackId), (rs, n) -> view(rs));
        return rows.stream().findFirst();
    }
    public void occupy(UUID slotId, UUID siteId, UUID zoneId, String trackId, String plate,
                       java.time.OffsetDateTime occurredAt, String snapshotReference) {
        jdbc.update("""
                INSERT INTO slot_occupancy(slot_id,site_id,zone_id,status,track_id,plate,last_seen_at,snapshot_reference,snapshot_seen_at)
                VALUES(:slotId,:siteId,:zoneId,'occupied',:trackId,:plate,:occurredAt,:snapshotReference,
                       CASE WHEN CAST(:snapshotReference AS varchar) IS NULL THEN NULL::timestamptz
                            ELSE CAST(:occurredAt AS timestamptz) END)
                ON CONFLICT(slot_id) DO UPDATE SET zone_id=EXCLUDED.zone_id,status='occupied',track_id=EXCLUDED.track_id,plate=EXCLUDED.plate,last_seen_at=EXCLUDED.last_seen_at,
                    snapshot_reference=COALESCE(EXCLUDED.snapshot_reference, slot_occupancy.snapshot_reference),
                    snapshot_seen_at=CASE WHEN EXCLUDED.snapshot_reference IS NULL THEN slot_occupancy.snapshot_seen_at ELSE EXCLUDED.snapshot_seen_at END,
                    updated_at=CURRENT_TIMESTAMP""",
                params(slotId).addValue("siteId",siteId,Types.OTHER).addValue("zoneId",zoneId,Types.OTHER).addValue("trackId",trackId).addValue("plate",plate).addValue("occurredAt",occurredAt).addValue("snapshotReference",snapshotReference));
    }
    public void free(UUID slotId) { jdbc.update("UPDATE slot_occupancy SET status='free',track_id=NULL,plate=NULL,updated_at=CURRENT_TIMESTAMP WHERE slot_id=:slotId",params(slotId)); }
    public List<SlotOccupancyView> list(UUID siteId, UUID zoneId) { return jdbc.query("SELECT slot_id,site_id,zone_id,status,track_id,plate,last_seen_at,snapshot_reference FROM slot_occupancy WHERE site_id=:siteId AND (CAST(:zoneId AS uuid) IS NULL OR zone_id=CAST(:zoneId AS uuid)) ORDER BY slot_id",params(null).addValue("siteId",siteId,Types.OTHER).addValue("zoneId",zoneId,Types.OTHER),(rs,n)->view(rs)); }
    private SlotOccupancyView view(java.sql.ResultSet rs) throws java.sql.SQLException { return new SlotOccupancyView(rs.getObject("slot_id",UUID.class),rs.getObject("site_id",UUID.class),rs.getObject("zone_id",UUID.class),rs.getString("status"),rs.getString("track_id"),rs.getString("plate"),rs.getObject("last_seen_at",java.time.OffsetDateTime.class),rs.getString("snapshot_reference")); }
    private MapSqlParameterSource params(UUID slotId) { return new MapSqlParameterSource().addValue("slotId",slotId,Types.OTHER); }
}
