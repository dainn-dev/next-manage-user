package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.dto.TenantAdminSummaryDto;
import com.vehiclemanagement.dto.TenantDetailDto;
import com.vehiclemanagement.dto.TenantPageResponse;
import com.vehiclemanagement.dto.TenantSiteSummaryDto;
import com.vehiclemanagement.dto.TenantStatisticsResponse;
import com.vehiclemanagement.dto.TenantStatusUpdateRequest;
import com.vehiclemanagement.dto.TenantSummaryDto;
import com.vehiclemanagement.dto.TenantUpdateRequest;
import com.vehiclemanagement.entity.TenantStatus;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.exception.TenantNotFoundException;
import com.vehiclemanagement.platform.PlatformAuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class TenantAdminService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final List<String> SORT_COLUMNS = List.of("name", "slug", "status", "createdAt", "updatedAt");

    private final JdbcTemplate jdbc;
    private final PlatformAuditService auditService;

    public TenantAdminService(JdbcTemplate jdbc, PlatformAuditService auditService) {
        this.jdbc = jdbc;
        this.auditService = auditService;
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public TenantPageResponse list(int page, int size, String searchTerm, TenantStatus status,
                                   String sortBy, String sortDir) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        String sortColumn = resolveSortColumn(sortBy);
        String direction = resolveSortDirection(sortDir);
        String search = searchTerm == null ? "" : searchTerm.trim();
        String statusValue = status == null ? null : status.value();

        // Postgres cannot infer the JDBC null parameter type for "? IS NULL", so cast explicitly.
        String where = " WHERE (CAST(? AS TEXT) IS NULL OR lower(t.name) LIKE lower(?) OR lower(t.slug) LIKE lower(?))"
                + " AND (CAST(? AS TEXT) IS NULL OR t.status = ?)";
        long total = jdbc.queryForObject(
                "SELECT count(*) FROM tenant t" + where,
                Long.class,
                search.isBlank() ? null : search,
                "%" + search + "%",
                "%" + search + "%",
                statusValue,
                statusValue);

        String sql = """
                SELECT t.id, t.name, t.slug, t.status, t.management_model, t.area_count,
                       t.created_at, t.updated_at,
                       (SELECT count(*) FROM site s WHERE s.tenant_id = t.id) AS site_count,
                       (SELECT count(*) FROM users u WHERE u.tenant_id = t.id AND u.role = 'TENANT_ADMIN') AS admin_count
                FROM tenant t
                """ + where + " ORDER BY t." + sortColumn + " " + direction + ", t.id ASC LIMIT ? OFFSET ?";

        List<TenantSummaryDto> content = jdbc.query(sql, (rs, rowNum) -> new TenantSummaryDto(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getString("slug"),
                        TenantStatus.fromValue(rs.getString("status")),
                        rs.getString("management_model"),
                        rs.getObject("area_count") == null ? null : rs.getInt("area_count"),
                        rs.getLong("site_count"),
                        rs.getLong("admin_count"),
                        rs.getTimestamp("created_at").toLocalDateTime(),
                        rs.getTimestamp("updated_at").toLocalDateTime()),
                search.isBlank() ? null : search,
                "%" + search + "%",
                "%" + search + "%",
                statusValue,
                statusValue,
                safeSize,
                safePage * safeSize);

        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new TenantPageResponse(content, total, totalPages, safeSize, safePage,
                safePage == 0, totalPages == 0 || safePage >= totalPages - 1, content.size());
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public TenantStatisticsResponse summary() {
        List<CountRow> rows = jdbc.query("SELECT status, count(*) AS count FROM tenant GROUP BY status",
                (rs, rowNum) -> new CountRow(rs.getString("status"), rs.getLong("count")));
        long active = count(rows, TenantStatus.ACTIVE);
        long suspended = count(rows, TenantStatus.SUSPENDED);
        long pending = count(rows, TenantStatus.PENDING_DELETION);
        return new TenantStatisticsResponse(active + suspended + pending, active, suspended, pending);
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public TenantDetailDto get(UUID id) {
        TenantRecord tenant = findTenant(id);
        List<TenantSiteSummaryDto> sites = jdbc.query("""
                SELECT id, name, location, created_at
                FROM site WHERE tenant_id = ? ORDER BY name ASC
                """, (rs, rowNum) -> new TenantSiteSummaryDto(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getString("location"),
                rs.getTimestamp("created_at").toLocalDateTime()), id);
        List<TenantAdminSummaryDto> admins = jdbc.query("""
                SELECT id, username, email, first_name, last_name, status, last_login
                FROM users WHERE tenant_id = ? AND role = 'TENANT_ADMIN' ORDER BY username ASC
                """, (rs, rowNum) -> new TenantAdminSummaryDto(
                rs.getObject("id", UUID.class),
                rs.getString("username"),
                rs.getString("email"),
                fullName(rs.getString("first_name"), rs.getString("last_name"), rs.getString("username")),
                User.UserStatus.valueOf(rs.getString("status")),
                rs.getTimestamp("last_login") == null ? null : rs.getTimestamp("last_login").toLocalDateTime()), id);
        return new TenantDetailDto(tenant.id(), tenant.name(), tenant.slug(), tenant.status(),
                tenant.managementModel(), tenant.areaCount(),
                tenant.createdAt(), tenant.updatedAt(), sites, admins);
    }

    @PlatformAdminOperation
    @Transactional
    public TenantDetailDto update(UUID id, TenantUpdateRequest request) {
        TenantRecord before = findTenant(id);
        String name = request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Tenant name is required");
        }
        Integer duplicate = jdbc.queryForObject(
                "SELECT count(*) FROM tenant WHERE lower(name) = lower(?) AND id <> ?",
                Integer.class, name, id);
        if (duplicate != null && duplicate > 0) {
            throw new IllegalArgumentException("Tenant name already exists");
        }
        jdbc.update("UPDATE tenant SET name = ?, updated_at = now() WHERE id = ?", name, id);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("previousName", before.name());
        detail.put("name", name);
        auditService.record("tenant_renamed", "tenant", id, detail);
        return get(id);
    }

    @PlatformAdminOperation
    @Transactional
    public TenantDetailDto updateStatus(UUID id, TenantStatusUpdateRequest request) {
        TenantRecord tenant = findTenant(id);
        TenantStatus target = request.status();
        if (target == tenant.status()) {
            return get(id);
        }
        if (target == TenantStatus.PENDING_DELETION && (request.reason() == null || request.reason().isBlank())) {
            throw new IllegalArgumentException("A reason is required before marking a tenant for deletion");
        }
        if (tenant.status() == TenantStatus.PENDING_DELETION) {
            throw new IllegalArgumentException("A tenant pending deletion cannot change status");
        }
        if (target != TenantStatus.ACTIVE && target != TenantStatus.SUSPENDED
                && target != TenantStatus.PENDING_DELETION) {
            throw new IllegalArgumentException("Unsupported tenant status transition");
        }
        jdbc.update("UPDATE tenant SET status = ?, updated_at = now() WHERE id = ?", target.value(), id);
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("from", tenant.status().value());
        detail.put("to", target.value());
        if (request.reason() != null && !request.reason().isBlank()) {
            detail.put("reason", request.reason().trim());
        }
        auditService.record("tenant_status_changed", "tenant", id, detail);
        return get(id);
    }

    private TenantRecord findTenant(UUID id) {
        List<TenantRecord> rows = jdbc.query("""
                SELECT id, name, slug, status, management_model, area_count, created_at, updated_at
                FROM tenant WHERE id = ?
                """, (rs, rowNum) -> new TenantRecord(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getString("slug"),
                TenantStatus.fromValue(rs.getString("status")),
                rs.getString("management_model"),
                rs.getObject("area_count") == null ? null : rs.getInt("area_count"),
                rs.getTimestamp("created_at").toLocalDateTime(),
                rs.getTimestamp("updated_at").toLocalDateTime()), id);
        if (rows.isEmpty()) {
            throw new TenantNotFoundException(id);
        }
        return rows.get(0);
    }

    private String resolveSortColumn(String sortBy) {
        String value = sortBy == null ? "updatedAt" : sortBy;
        if (!SORT_COLUMNS.contains(value)) {
            throw new IllegalArgumentException("Unsupported tenant sort field");
        }
        return switch (value) {
            case "createdAt" -> "created_at";
            case "updatedAt" -> "updated_at";
            default -> value;
        };
    }

    private String resolveSortDirection(String sortDir) {
        String value = sortDir == null ? "desc" : sortDir.toLowerCase(Locale.ROOT);
        if (!value.equals("asc") && !value.equals("desc")) {
            throw new IllegalArgumentException("Unsupported tenant sort direction");
        }
        return value;
    }

    private long count(List<CountRow> rows, TenantStatus status) {
        return rows.stream().filter(row -> status.value().equals(row.status())).mapToLong(CountRow::count).findFirst().orElse(0);
    }

    private String fullName(String firstName, String lastName, String fallback) {
        String name = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        return name.isBlank() ? fallback : name;
    }

    private record CountRow(String status, long count) {
    }

    private record TenantRecord(UUID id, String name, String slug, TenantStatus status,
                                String managementModel, Integer areaCount,
                                java.time.LocalDateTime createdAt, java.time.LocalDateTime updatedAt) {
    }
}
