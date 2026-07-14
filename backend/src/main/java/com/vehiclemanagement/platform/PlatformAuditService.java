package com.vehiclemanagement.platform;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.entity.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PlatformAuditService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public PlatformAuditService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @PlatformAdminOperation
    @Transactional
    public UUID record(String action, String resourceType, UUID resourceId, Map<String, ?> detail) {
        Actor actor = currentActor();
        UUID auditId = jdbc.queryForObject("""
                INSERT INTO platform_audit_log(actor_user_id, actor_username, action, resource_type, resource_id, detail)
                VALUES (?, ?, ?, ?, ?, ?::jsonb)
                RETURNING id
                """,
                UUID.class,
                actor.userId(),
                actor.username(),
                action,
                resourceType,
                resourceId,
                toJson(detail == null ? Map.of() : detail));
        return auditId;
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public PlatformAuditPageResponse list(int page, int size, String action, String resourceType, UUID resourceId) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String actionFilter = blankToNull(action);
        String resourceFilter = blankToNull(resourceType);

        Long total = jdbc.queryForObject("""
                SELECT count(*) FROM platform_audit_log
                WHERE (CAST(? AS TEXT) IS NULL OR action = ?)
                  AND (CAST(? AS TEXT) IS NULL OR resource_type = ?)
                  AND (CAST(? AS UUID) IS NULL OR resource_id = ?)
                """, Long.class, actionFilter, actionFilter, resourceFilter, resourceFilter, resourceId, resourceId);
        long totalCount = total == null ? 0 : total;

        List<PlatformAuditEntryDto> content = jdbc.query("""
                SELECT id, actor_user_id, actor_username, action, resource_type, resource_id, detail::text, created_at
                FROM platform_audit_log
                WHERE (CAST(? AS TEXT) IS NULL OR action = ?)
                  AND (CAST(? AS TEXT) IS NULL OR resource_type = ?)
                  AND (CAST(? AS UUID) IS NULL OR resource_id = ?)
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
                """, (rs, rowNum) -> new PlatformAuditEntryDto(
                        rs.getObject("id", UUID.class),
                        rs.getObject("actor_user_id", UUID.class),
                        rs.getString("actor_username"),
                        rs.getString("action"),
                        rs.getString("resource_type"),
                        rs.getObject("resource_id", UUID.class),
                        rs.getString("detail"),
                        rs.getTimestamp("created_at").toLocalDateTime()),
                actionFilter, actionFilter, resourceFilter, resourceFilter, resourceId, resourceId,
                safeSize, safePage * safeSize);

        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / safeSize);
        return new PlatformAuditPageResponse(content, totalCount, totalPages, safeSize, safePage,
                safePage == 0, totalPages == 0 || safePage >= totalPages - 1, content.size());
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public List<PlatformAuditEntryDto> recent(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 20);
        return jdbc.query("""
                SELECT id, actor_user_id, actor_username, action, resource_type, resource_id, detail::text, created_at
                FROM platform_audit_log
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """, (rs, rowNum) -> new PlatformAuditEntryDto(
                rs.getObject("id", UUID.class),
                rs.getObject("actor_user_id", UUID.class),
                rs.getString("actor_username"),
                rs.getString("action"),
                rs.getString("resource_type"),
                rs.getObject("resource_id", UUID.class),
                rs.getString("detail"),
                rs.getTimestamp("created_at").toLocalDateTime()), safeLimit);
    }

    private Actor currentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            return new Actor(null, "system");
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof User user) {
            return new Actor(user.getId(), user.getUsername());
        }
        return new Actor(null, auth.getName());
    }

    private String toJson(Map<String, ?> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private record Actor(UUID userId, String username) {
    }

    public record PlatformAuditEntryDto(
            UUID id,
            UUID actorUserId,
            String actorUsername,
            String action,
            String resourceType,
            UUID resourceId,
            String detail,
            LocalDateTime createdAt) {
    }

    public record PlatformAuditPageResponse(
            List<PlatformAuditEntryDto> content,
            long totalElements,
            int totalPages,
            int size,
            int number,
            boolean first,
            boolean last,
            int numberOfElements) {
    }
}
