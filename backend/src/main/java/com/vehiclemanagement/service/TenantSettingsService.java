package com.vehiclemanagement.service;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.dto.TenantSettingsResponse;
import com.vehiclemanagement.dto.TenantSettingsUpdateRequest;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class TenantSettingsService {

    private final JdbcTemplate jdbc;

    public TenantSettingsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public TenantSettingsResponse getMe() {
        UUID tenantId = requireTenant();
        return load(tenantId);
    }

    @Transactional
    public TenantSettingsResponse updateMe(TenantSettingsUpdateRequest request) {
        UUID tenantId = requireTenant();
        String name = request.getName().trim();
        String managementModel = request.getManagementModel().trim().toLowerCase(Locale.ROOT);
        Integer areaCount = request.getAreaCount();

        Integer duplicate = jdbc.queryForObject(
                "SELECT count(*) FROM tenant WHERE lower(name) = lower(?) AND id <> ?",
                Integer.class, name, tenantId);
        if (duplicate != null && duplicate > 0) {
            throw new ConflictException("Organization name already exists");
        }

        try {
            int updated = jdbc.update("""
                    UPDATE tenant
                    SET name = ?, management_model = ?, area_count = ?, updated_at = now()
                    WHERE id = ?
                    """, name, managementModel, areaCount, tenantId);
            if (updated == 0) {
                throw new ResourceNotFoundException("Tenant not found");
            }
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Invalid organization profile values", ex);
        }

        return load(tenantId);
    }

    private TenantSettingsResponse load(UUID tenantId) {
        return jdbc.query("""
                SELECT t.id, t.name, t.slug, t.status, t.management_model, t.area_count,
                       (SELECT count(*) FROM site s WHERE s.tenant_id = t.id) AS site_count,
                       p.code AS plan_code, p.name AS plan_name
                FROM tenant t
                LEFT JOIN billing_plan p ON p.id = t.plan_id
                WHERE t.id = ?
                """, rs -> {
            if (!rs.next()) {
                throw new ResourceNotFoundException("Tenant not found");
            }
            Integer areaCount = rs.getObject("area_count") == null ? null : rs.getInt("area_count");
            return new TenantSettingsResponse(
                    rs.getObject("id", UUID.class),
                    rs.getString("name"),
                    rs.getString("slug"),
                    rs.getString("status"),
                    rs.getString("management_model"),
                    areaCount,
                    rs.getLong("site_count"),
                    rs.getString("plan_code"),
                    rs.getString("plan_name"));
        }, tenantId);
    }

    private UUID requireTenant() {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalStateException("Tenant context is required");
        }
        return tenantId;
    }
}
