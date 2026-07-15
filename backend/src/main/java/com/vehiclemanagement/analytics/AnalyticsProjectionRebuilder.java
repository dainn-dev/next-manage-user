package com.vehiclemanagement.analytics;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Replays the durable event log. Rebuilding makes late-event handling deterministic. */
@Service
public class AnalyticsProjectionRebuilder {
    private final JdbcTemplate jdbc;
    public AnalyticsProjectionRebuilder(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Scheduled(fixedDelayString = "${analytics.rebuild-delay-ms:60000}")
    @PlatformAdminOperation
    @Transactional
    public void rebuild() {
        jdbc.update("TRUNCATE analytics_site_daily, analytics_vehicle_daily, analytics_slot_daily");
        jdbc.update("""
            WITH e AS (SELECT tenant_id,site_id,event_type,identity_key,occurred_at,
              lead(event_type) OVER w next_type,lead(occurred_at) OVER w next_at
              FROM parking_event WINDOW w AS
              (PARTITION BY tenant_id,site_id,identity_key ORDER BY transition_sequence,occurred_at,id))
            INSERT INTO analytics_site_daily(tenant_id,site_id,bucket_date,entries,exits,completed_sessions,total_dwell_seconds)
            SELECT tenant_id,site_id,occurred_at::date,
              count(*) FILTER(WHERE event_type='VehicleEntered'),count(*) FILTER(WHERE event_type='VehicleExited'),
              count(*) FILTER(WHERE event_type='VehicleEntered' AND next_type='VehicleExited' AND next_at>=occurred_at),
              COALESCE(sum(extract(epoch FROM next_at-occurred_at)) FILTER
                (WHERE event_type='VehicleEntered' AND next_type='VehicleExited' AND next_at>=occurred_at),0)
            FROM e GROUP BY tenant_id,site_id,occurred_at::date
            """);
        jdbc.update("""
            INSERT INTO analytics_vehicle_daily(tenant_id,site_id,bucket_date,license_plate,visits)
            SELECT tenant_id,site_id,occurred_at::date,upper(btrim(payload #>> '{payload,identity,license_plate}')),count(*)
            FROM parking_event WHERE event_type='VehicleEntered'
              AND NULLIF(btrim(payload #>> '{payload,identity,license_plate}'),'') IS NOT NULL
            GROUP BY tenant_id,site_id,occurred_at::date,upper(btrim(payload #>> '{payload,identity,license_plate}'))
            """);
        jdbc.update("""
            WITH e AS (SELECT tenant_id,site_id,identity_key,occurred_at,event_type,
              NULLIF(payload #>> '{payload,slot_id}','')::uuid slot_id,
              lead(event_type) OVER w next_type,lead(occurred_at) OVER w next_at
              FROM parking_event WINDOW w AS
              (PARTITION BY tenant_id,site_id,identity_key ORDER BY transition_sequence,occurred_at,id))
            INSERT INTO analytics_slot_daily(tenant_id,site_id,bucket_date,slot_id,occupied_seconds,visits)
            SELECT tenant_id,site_id,occurred_at::date,slot_id,sum(extract(epoch FROM next_at-occurred_at)),count(*)
            FROM e WHERE event_type='VehicleEntered' AND next_type='VehicleExited'
              AND next_at>=occurred_at AND slot_id IS NOT NULL
            GROUP BY tenant_id,site_id,occurred_at::date,slot_id
            """);
        jdbc.update("""
            INSERT INTO analytics_projection_checkpoint(name,source_event_count,source_max_occurred_at,rebuilt_at)
            SELECT 'parking-event-v1',count(*),max(occurred_at),CURRENT_TIMESTAMP FROM parking_event
            ON CONFLICT(name) DO UPDATE SET source_event_count=excluded.source_event_count,
              source_max_occurred_at=excluded.source_max_occurred_at,rebuilt_at=excluded.rebuilt_at
            """);
    }
}
