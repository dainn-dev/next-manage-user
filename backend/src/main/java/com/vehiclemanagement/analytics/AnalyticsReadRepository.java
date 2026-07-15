package com.vehiclemanagement.analytics;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class AnalyticsReadRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public AnalyticsReadRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public AnalyticsSummary summary(UUID siteId, LocalDate from, LocalDate to, int topLimit) {
        var p = new MapSqlParameterSource().addValue("siteId", siteId, Types.OTHER)
                .addValue("from", from).addValue("to", to).addValue("limit", topLimit);
        var totals = jdbc.queryForMap("""
            SELECT COALESCE(sum(entries),0) entries, COALESCE(sum(exits),0) exits,
              COALESCE(sum(completed_sessions),0) sessions, COALESCE(sum(total_dwell_seconds),0) dwell,
              max(rebuilt_at) as_of FROM analytics_site_daily
             WHERE site_id=:siteId AND bucket_date BETWEEN :from AND :to
            """, p);
        var occupancy = jdbc.queryForMap("""
            SELECT count(*) FILTER (WHERE o.status='occupied') occupied, count(*) total
              FROM parking_slot s LEFT JOIN slot_occupancy o ON o.slot_id=s.id
             WHERE s.site_id=:siteId AND s.admin_status='enabled'
            """, p);
        List<AnalyticsSummary.ReturningVehicle> top = jdbc.query("""
            SELECT license_plate,sum(visits) visits FROM analytics_vehicle_daily
             WHERE site_id=:siteId AND bucket_date BETWEEN :from AND :to
             GROUP BY license_plate ORDER BY visits DESC,license_plate ASC LIMIT :limit
            """, p, (rs,n) -> new AnalyticsSummary.ReturningVehicle(rs.getString(1),rs.getLong(2)));
        List<AnalyticsSummary.HeatmapCell> heatmap = jdbc.query("""
            WITH cells AS (SELECT slot_id,sum(occupied_seconds)::double precision seconds,sum(visits) visits
              FROM analytics_slot_daily WHERE site_id=:siteId AND bucket_date BETWEEN :from AND :to GROUP BY slot_id)
            SELECT slot_id,seconds,visits,CASE WHEN max(seconds) OVER ()=0 THEN 0
              ELSE seconds/max(seconds) OVER () END intensity FROM cells ORDER BY intensity DESC,slot_id
            """, p, (rs,n) -> new AnalyticsSummary.HeatmapCell(rs.getObject(1,UUID.class),rs.getDouble(2),rs.getLong(3),rs.getDouble(4)));
        long sessions=((Number)totals.get("sessions")).longValue(), occupied=((Number)occupancy.get("occupied")).longValue();
        long slots=((Number)occupancy.get("total")).longValue(); double dwell=((Number)totals.get("dwell")).doubleValue();
        return new AnalyticsSummary(siteId,from,to,((Number)totals.get("entries")).longValue(),
            ((Number)totals.get("exits")).longValue(),sessions,sessions==0?0:dwell/sessions,occupied,slots,
            slots==0?0:(double)occupied/slots,(OffsetDateTime)totals.get("as_of"),top,heatmap);
    }
}
