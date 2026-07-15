package com.vehiclemanagement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

/** At-least-once relay for durable camera-ingest outbox messages. */
@Component
public class CameraIngestOutboxRelay {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final OutboxBus bus;
    private final int batchSize;

    public CameraIngestOutboxRelay(JdbcTemplate jdbc, ObjectMapper objectMapper, OutboxBus bus,
            MeterRegistry meterRegistry,
            @Value("${outbox.camera-ingest.batch-size:100}") int batchSize) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.bus = bus;
        this.batchSize = batchSize;
        Gauge.builder("camera.ingest.outbox.pending", jdbc, template -> {
                    Integer count = template.queryForObject("SELECT count(*) FROM outbox_message WHERE aggregate_type IN ('camera_ingest','parking_event') AND status IN ('pending','failed')", Integer.class);
                    return count == null ? 0 : count;
                })
                .description("Camera ingest messages waiting for outbox dispatch")
                .register(meterRegistry);
    }

    @Scheduled(fixedDelayString = "${outbox.camera-ingest.poll-delay-ms:1000}")
    @PlatformAdminOperation
    @Transactional
    public void relayPending() {
        List<Row> rows = jdbc.query("""
                SELECT id, tenant_id, routing_key, payload::text
                  FROM outbox_message
                 WHERE aggregate_type IN ('camera_ingest', 'parking_event') AND status IN ('pending', 'failed')
                 ORDER BY created_at
                 LIMIT ? FOR UPDATE SKIP LOCKED
                """, (rs, n) -> new Row(
                        rs.getObject("id", UUID.class),
                        rs.getObject("tenant_id", UUID.class),
                        rs.getString("routing_key"),
                        rs.getString("payload")), batchSize);

        for (Row row : rows) {
            try {
                bus.publish(new OutboxBus.OutboxEvent(row.id, row.tenantId, row.routingKey,
                        objectMapper.readTree(row.payload)));
                jdbc.update("""
                        UPDATE outbox_message SET status='dispatched', dispatched_at=?,
                            attempts=attempts+1, last_error=NULL WHERE id=?
                        """, Timestamp.from(OffsetDateTime.now().toInstant()), row.id);
            } catch (Exception ex) {
                jdbc.update("""
                        UPDATE outbox_message SET status='failed', attempts=attempts+1,
                            last_error=? WHERE id=?
                        """, abbreviate(ex.getMessage()), row.id);
            }
        }
    }

    private String abbreviate(String message) {
        if (message == null) return "Unknown bus publishing error";
        return message.length() <= 1000 ? message : message.substring(0, 1000);
    }

    private record Row(UUID id, UUID tenantId, String routingKey, String payload) {}
}
