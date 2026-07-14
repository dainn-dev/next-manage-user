package com.vehiclemanagement.billing;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.service.OutboxBus;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.time.ZoneOffset;

/** Idempotently projects camera-ingest bus messages into monthly billing usage. */
@Component
public class BillingUsageMeter {
    private static final String METRIC = "camera_events_month";
    private final JdbcTemplate jdbc;

    public BillingUsageMeter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener
    @PlatformAdminOperation
    @Transactional
    public void onOutboxEvent(OutboxBus.OutboxEvent event) {
        if (!event.routingKey().startsWith("camera.ingest.")) return;
        int inserted = jdbc.update("""
                INSERT INTO processed_usage_event(message_id,tenant_id,metric)
                VALUES (?,?,?) ON CONFLICT(message_id) DO NOTHING
                """, event.messageId(), event.tenantId(), METRIC);
        if (inserted == 0) return;
        jdbc.update("""
                INSERT INTO billing_usage_record(tenant_id,metric,qty,period)
                VALUES (?,?,1,?)
                ON CONFLICT(tenant_id,metric,period) DO UPDATE
                SET qty=billing_usage_record.qty+1, updated_at=CURRENT_TIMESTAMP
                """, event.tenantId(), METRIC, YearMonth.now(ZoneOffset.UTC).toString());
    }
}
