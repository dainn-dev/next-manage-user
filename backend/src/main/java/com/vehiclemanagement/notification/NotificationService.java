package com.vehiclemanagement.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.service.OutboxBus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
@ConditionalOnProperty(name = "notification.enabled", havingValue = "true")
public class NotificationService {
    private static final Set<String> SUPPORTED = Set.of("VehicleRelocated", "VehicleExited", "PersonProximity",
            "CameraOffline");
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final SimpMessagingTemplate messaging;
    private final int maxAttempts;
    private final int rateLimit;

    public NotificationService(JdbcTemplate jdbc, ObjectMapper json, SimpMessagingTemplate messaging,
            @Value("${notification.max-attempts:5}") int maxAttempts,
            @Value("${notification.rate-limit-per-minute:20}") int rateLimit) {
        this.jdbc = jdbc;
        this.json = json;
        this.messaging = messaging;
        this.maxAttempts = maxAttempts;
        this.rateLimit = rateLimit;
    }

    @EventListener
    @PlatformAdminOperation
    @Transactional
    public void consume(OutboxBus.OutboxEvent event) {
        String type = eventType(event.routingKey(), event.payload());
        if (!SUPPORTED.contains(type))
            return;
        UUID siteId = uuid(text(event.payload(), "site_id", "siteId"));
        if (siteId == null) {
            UUID cameraId = uuid(text(event.payload(), "camera_id", "cameraId"));
            if (cameraId != null)
                siteId = jdbc.query("SELECT site_id FROM camera WHERE id=? AND tenant_id=?",
                        rs -> rs.next() ? rs.getObject(1, UUID.class) : null, cameraId, event.tenantId());
        }
        UUID sourceId = uuid(text(event.payload(), "event_id", "eventId"));
        if (sourceId == null)
            sourceId = event.messageId();
        List<Recipient> recipients = jdbc.query("""
                SELECT DISTINCT u.id, u.username FROM users u
                LEFT JOIN user_site us ON us.user_id=u.id AND us.tenant_id=u.tenant_id
                WHERE u.tenant_id=? AND u.status='ACTIVE'
                  AND u.role IN ('TENANT_ADMIN','SITE_MANAGER','SECURITY_GUARD')
                  AND (u.role='TENANT_ADMIN' OR us.site_id=?)
                """, (rs, n) -> new Recipient(rs.getObject(1, UUID.class), rs.getString(2)), event.tenantId(), siteId);
        for (Recipient recipient : recipients)
            createForRecipient(event, sourceId, siteId, type, recipient);
    }

    private void createForRecipient(OutboxBus.OutboxEvent event, UUID sourceId, UUID siteId, String type,
            Recipient recipient) {
        List<Preference> preferences = jdbc.query("""
                SELECT channel,enabled,quiet_start,quiet_end,timezone FROM notification_preference
                 WHERE tenant_id=? AND user_id=? AND event_type=? AND (site_id=? OR site_id IS NULL)
                 ORDER BY site_id NULLS LAST
                """,
                (rs, n) -> new Preference(rs.getString(1), rs.getBoolean(2),
                        rs.getTime(3) == null ? null : rs.getTime(3).toLocalTime(),
                        rs.getTime(4) == null ? null : rs.getTime(4).toLocalTime(), rs.getString(5)),
                event.tenantId(), recipient.id(), type, siteId);
        if (preferences.isEmpty())
            preferences = List.of(new Preference("IN_APP", true, null, null, "UTC"));
        Map<String, Preference> effective = new LinkedHashMap<>();
        preferences.forEach(p -> effective.putIfAbsent(p.channel(), p));
        for (Preference preference : effective.values()) {
            OffsetDateTime now = OffsetDateTime.now();
            PreferenceDecision decision = preferenceDecision(preference.enabled(), now, preference.quietStart(),
                    preference.quietEnd(), preference.timezone());
            if (decision == PreferenceDecision.DISABLED)
                continue;
            OffsetDateTime next = decision == PreferenceDecision.DEFERRED
                    ? quietEnd(now, preference.quietStart(), preference.quietEnd(), preference.timezone())
                    : null;
            String status = next == null ? "PENDING" : "PENDING";
            Long recent = jdbc.queryForObject("""
                    SELECT count(*) FROM notification WHERE tenant_id=? AND user_id=? AND event_type=?
                    AND created_at>now()-interval '1 minute' AND status IN ('PENDING','DELIVERED','FAILED')
                    """, Long.class, event.tenantId(), recipient.id(), type);
            if (recent != null && recent >= rateLimit)
                status = "SUPPRESSED";
            int inserted = jdbc.update("""
                    INSERT INTO notification(tenant_id,site_id,user_id,source_event_id,event_type,channel,
                      template_key,locale,payload,status,next_attempt_at)
                    VALUES (?,?,?,?,?,?,?,'en',CAST(? AS jsonb),?,?)
                    ON CONFLICT (tenant_id,source_event_id,user_id,channel) DO NOTHING
                    """, event.tenantId(), siteId, recipient.id(), sourceId, type, preference.channel(),
                    "notification." + type, event.payload().toString(), status,
                    next == null ? Timestamp.from(now.toInstant()) : Timestamp.from(next.toInstant()));
            if (inserted == 1 && next == null && "PENDING".equals(status))
                deliver(findId(event.tenantId(), sourceId, recipient.id(), preference.channel()), recipient.username());
        }
    }

    @Scheduled(fixedDelayString = "${notification.retry-poll-ms:5000}")
    @PlatformAdminOperation
    @Transactional
    public void retryDue() {
        List<Delivery> due = jdbc.query("""
                SELECT n.id,u.username FROM notification n JOIN users u ON u.id=n.user_id AND u.tenant_id=n.tenant_id
                 WHERE n.status IN ('PENDING','FAILED') AND n.next_attempt_at<=now()
                 ORDER BY n.created_at LIMIT 100 FOR UPDATE OF n SKIP LOCKED
                """, (rs, n) -> new Delivery(rs.getObject(1, UUID.class), rs.getString(2)));
        due.forEach(d -> deliver(d.id(), d.username()));
    }

    private UUID findId(UUID tenantId, UUID sourceId, UUID userId, String channel) {
        return jdbc.queryForObject(
                "SELECT id FROM notification WHERE tenant_id=? AND source_event_id=? AND user_id=? AND channel=?",
                UUID.class, tenantId, sourceId, userId, channel);
    }

    private void deliver(UUID id, String username) {
        DeliveryRow row = jdbc.queryForObject(
                "SELECT user_id,channel,payload::text,attempts FROM notification WHERE id=? FOR UPDATE",
                (rs, n) -> new DeliveryRow(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getInt(4)),
                id);
        if (row == null)
            return;
        int attempt = row.attempts() + 1;
        try {
            if (!"IN_APP".equals(row.channel()))
                throw new IllegalStateException(row.channel() + " adapter is not configured");
            messaging.convertAndSendToUser(username, "/queue/notifications", json.readTree(row.payload()));
            jdbc.update(
                    "UPDATE notification SET status='DELIVERED',attempts=?,delivered_at=now(),next_attempt_at=NULL,last_error=NULL WHERE id=?",
                    attempt, id);
            audit(id, attempt, "DELIVERED", null);
        } catch (Exception ex) {
            boolean dead = attempt >= maxAttempts;
            long delay = Math.min(3600, 1L << Math.min(attempt, 10));
            String error = abbreviate(ex.getMessage());
            jdbc.update("UPDATE notification SET status=?,attempts=?,next_attempt_at=?,last_error=? WHERE id=?",
                    dead ? "DEAD_LETTER" : "FAILED", attempt,
                    dead ? null : Timestamp.from(Instant.now().plusSeconds(delay)), error, id);
            audit(id, attempt, dead ? "DEAD_LETTER" : "FAILED", error);
        }
    }

    private void audit(UUID id, int attempt, String outcome, String error) {
        jdbc.update(
                "INSERT INTO notification_delivery_attempt(tenant_id,notification_id,attempt_number,outcome,error) SELECT tenant_id,id,?,?,? FROM notification WHERE id=?",
                attempt, outcome, error, id);
    }

    static OffsetDateTime quietEnd(OffsetDateTime now, LocalTime start, LocalTime end, String zoneName) {
        if (start == null || end == null)
            return null;
        ZoneId zone = ZoneId.of(zoneName == null ? "UTC" : zoneName);
        ZonedDateTime local = now.atZoneSameInstant(zone);
        LocalTime time = local.toLocalTime();
        boolean overnight = !start.isBefore(end);
        boolean quiet = overnight ? !time.isBefore(start) || time.isBefore(end)
                : !time.isBefore(start) && time.isBefore(end);
        if (!quiet)
            return null;
        LocalDate date = local.toLocalDate();
        if (overnight && !time.isBefore(start))
            date = date.plusDays(1);
        return ZonedDateTime.of(date, end, zone).toOffsetDateTime();
    }

    static PreferenceDecision preferenceDecision(boolean enabled, OffsetDateTime now, LocalTime start, LocalTime end,
            String zoneName) {
        if (!enabled)
            return PreferenceDecision.DISABLED;
        return quietEnd(now, start, end, zoneName) == null ? PreferenceDecision.READY : PreferenceDecision.DEFERRED;
    }

    enum PreferenceDecision {
        DISABLED, READY, DEFERRED
    }

    private String eventType(String key, JsonNode payload) {
        String fromPayload = payload.path("event_type").asText("");
        if (!fromPayload.isBlank())
            return fromPayload;
        for (String type : SUPPORTED)
            if (key.endsWith("." + type))
                return type;
        return "";
    }

    private UUID uuid(String value) {
        try {
            return value == null ? null : UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String text(JsonNode node, String first, String second) {
        String value = node.path(first).asText(null);
        return value == null ? node.path(second).asText(null) : value;
    }

    private String abbreviate(String value) {
        if (value == null)
            return "Unknown delivery failure";
        return value.substring(0, Math.min(500, value.length()));
    }

    private record Recipient(UUID id, String username) {
    }

    private record Preference(String channel, boolean enabled, LocalTime quietStart, LocalTime quietEnd,
            String timezone) {
    }

    private record Delivery(UUID id, String username) {
    }

    private record DeliveryRow(UUID userId, String channel, String payload, int attempts) {
    }
}
