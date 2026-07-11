package com.vehiclemanagement.platform;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PlatformBillingService {

    private static final int MAX_PAGE_SIZE = 100;

    private final JdbcTemplate jdbc;

    public PlatformBillingService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public PlatformSubscriptionPageResponse listSubscriptions(int page, int size, String status, String searchTerm) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        String search = searchTerm == null ? "" : searchTerm.trim();
        String statusFilter = blankToNull(status);

        String where = """
                WHERE (CAST(? AS TEXT) IS NULL OR lower(t.name) LIKE lower(?) OR lower(t.slug) LIKE lower(?))
                  AND (CAST(? AS TEXT) IS NULL OR COALESCE(bs.status, 'none') = ?)
                """;

        Long total = jdbc.queryForObject("""
                SELECT count(*)
                FROM tenant t
                LEFT JOIN billing_subscription bs ON bs.tenant_id = t.id
                """ + where,
                Long.class,
                search.isBlank() ? null : search,
                "%" + search + "%",
                "%" + search + "%",
                statusFilter,
                statusFilter);
        long totalCount = total == null ? 0 : total;

        List<PlatformSubscriptionDto> content = jdbc.query("""
                SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug, t.status AS tenant_status,
                       COALESCE(bp_sub.code, bp_tenant.code) AS plan_code,
                       COALESCE(bp_sub.name, bp_tenant.name) AS plan_name,
                       bs.status AS subscription_status,
                       bs.current_period_end,
                       bs.past_due_since,
                       COALESCE(bs.cancel_at_period_end, false) AS cancel_at_period_end
                FROM tenant t
                LEFT JOIN billing_subscription bs ON bs.tenant_id = t.id
                LEFT JOIN billing_plan bp_sub ON bp_sub.id = bs.plan_id
                LEFT JOIN billing_plan bp_tenant ON bp_tenant.id = t.plan_id
                """ + where + """
                ORDER BY t.updated_at DESC, t.id ASC
                LIMIT ? OFFSET ?
                """, (rs, rowNum) -> new PlatformSubscriptionDto(
                        rs.getObject("tenant_id", UUID.class),
                        rs.getString("tenant_name"),
                        rs.getString("tenant_slug"),
                        rs.getString("tenant_status"),
                        rs.getString("plan_code"),
                        rs.getString("plan_name"),
                        rs.getString("subscription_status") == null ? "none" : rs.getString("subscription_status"),
                        rs.getTimestamp("current_period_end") == null
                                ? null : rs.getTimestamp("current_period_end").toLocalDateTime(),
                        rs.getTimestamp("past_due_since") == null
                                ? null : rs.getTimestamp("past_due_since").toLocalDateTime(),
                        rs.getBoolean("cancel_at_period_end")),
                search.isBlank() ? null : search,
                "%" + search + "%",
                "%" + search + "%",
                statusFilter,
                statusFilter,
                safeSize,
                safePage * safeSize);

        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / safeSize);
        return new PlatformSubscriptionPageResponse(content, totalCount, totalPages, safeSize, safePage,
                safePage == 0, totalPages == 0 || safePage >= totalPages - 1, content.size());
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public PlatformBillingSummaryResponse summary() {
        Map<String, Long> byStatus = new HashMap<>();
        jdbc.query("""
                SELECT COALESCE(bs.status, 'none') AS status, count(*) AS count
                FROM tenant t
                LEFT JOIN billing_subscription bs ON bs.tenant_id = t.id
                GROUP BY COALESCE(bs.status, 'none')
                """, rs -> {
            byStatus.put(rs.getString("status"), rs.getLong("count"));
        });
        long withSubscription = byStatus.entrySet().stream()
                .filter(e -> !"none".equals(e.getKey()))
                .mapToLong(Map.Entry::getValue)
                .sum();
        long withoutSubscription = byStatus.getOrDefault("none", 0L);
        return new PlatformBillingSummaryResponse(withSubscription, withoutSubscription, byStatus);
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public record PlatformSubscriptionDto(
            UUID tenantId,
            String tenantName,
            String tenantSlug,
            String tenantStatus,
            String planCode,
            String planName,
            String subscriptionStatus,
            LocalDateTime currentPeriodEnd,
            LocalDateTime pastDueSince,
            boolean cancelAtPeriodEnd) {
    }

    public record PlatformSubscriptionPageResponse(
            List<PlatformSubscriptionDto> content,
            long totalElements,
            int totalPages,
            int size,
            int number,
            boolean first,
            boolean last,
            int numberOfElements) {
    }

    public record PlatformBillingSummaryResponse(
            long withSubscription,
            long withoutSubscription,
            Map<String, Long> byStatus) {
    }
}
