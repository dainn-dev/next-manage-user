package com.vehiclemanagement.repository;

import com.vehiclemanagement.dto.AverageDwellDto;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
public class AverageDwellReadRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public AverageDwellReadRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AverageDwellDto calculate(UUID siteId, OffsetDateTime from, OffsetDateTime to) {
        return jdbc.queryForObject("""
                SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))), 0) AS average_seconds,
                       COUNT(*) AS completed_sessions
                  FROM parking_session
                 WHERE site_id = :siteId
                   AND status = 'CLOSED'
                   AND ended_at IS NOT NULL AND ended_at >= started_at
                   AND ended_at >= :from AND ended_at < :to
                """, new MapSqlParameterSource()
                        .addValue("siteId", siteId, Types.OTHER)
                        .addValue("from", from)
                        .addValue("to", to),
                (rs, row) -> new AverageDwellDto(siteId, from, to,
                        rs.getDouble("average_seconds"), rs.getLong("completed_sessions")));
    }
}
