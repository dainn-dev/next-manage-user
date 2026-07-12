package com.vehiclemanagement.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.repository.CameraRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.OptionalLong;
import java.util.UUID;
import java.util.function.LongSupplier;

@Service
public class EntitlementGuard {

    private static final Logger log = LoggerFactory.getLogger(EntitlementGuard.class);
    private static final String UPGRADE_URL = "/billing";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final CameraRepository cameraRepository;
    private final BillingFeatureProperties featureProperties;

    public EntitlementGuard(JdbcTemplate jdbc,
                            ObjectMapper objectMapper,
                            CameraRepository cameraRepository,
                            BillingFeatureProperties featureProperties) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.cameraRepository = cameraRepository;
        this.featureProperties = featureProperties;
    }

    public void assertCameraCreationAllowed(UUID siteId) {
        assertWithinLimit(
                EntitlementMetric.MAX_CAMERAS_PER_SITE,
                siteId.toString(),
                () -> cameraRepository.countBySiteId(siteId));
    }

    public void assertSiteCreationAllowed() {
        UUID tenantId = TenantContext.getTenantId();
        assertWithinLimit(EntitlementMetric.MAX_SITES, "tenant", () -> countSites(tenantId));
    }

    public void assertUserCreationAllowed() {
        UUID tenantId = TenantContext.getTenantId();
        assertWithinLimit(EntitlementMetric.USERS_PER_TENANT, "tenant", () -> countUsers(tenantId));
    }

    public Map<String, Long> currentStructuralUsage() {
        UUID tenantId = TenantContext.getTenantId();
        Map<String, Long> usage = new LinkedHashMap<>();
        usage.put(EntitlementMetric.MAX_SITES.limitKey(), countSites(tenantId));
        usage.put(EntitlementMetric.MAX_CAMERAS_PER_SITE.limitKey(), currentMaxCamerasPerSite(tenantId));
        usage.put(EntitlementMetric.USERS_PER_TENANT.limitKey(), countUsers(tenantId));
        return usage;
    }

    /**
     * Count by explicit tenant_id so usage is correct even when the DB role
     * bypasses RLS (e.g. integration-test superuser).
     */
    private long countSites(UUID tenantId) {
        if (tenantId == null) {
            return 0L;
        }
        Long value = jdbc.queryForObject(
                "SELECT count(*) FROM site WHERE tenant_id = ?", Long.class, tenantId);
        return value == null ? 0L : value;
    }

    private long countUsers(UUID tenantId) {
        if (tenantId == null) {
            return 0L;
        }
        // Ops users still live on users.tenant_id; platform MEMBERs count via affiliation.
        Long value = jdbc.queryForObject("""
                SELECT count(*) FROM (
                    SELECT id AS uid FROM users
                    WHERE tenant_id = ? AND role <> 'MEMBER'
                    UNION
                    SELECT user_id AS uid FROM member_affiliation
                    WHERE tenant_id = ? AND status = 'ACTIVE'
                ) seats
                """, Long.class, tenantId, tenantId);
        return value == null ? 0L : value;
    }

    private long currentMaxCamerasPerSite(UUID tenantId) {
        if (tenantId == null) {
            return 0L;
        }
        Long value = jdbc.queryForObject("""
                SELECT COALESCE(MAX(camera_count), 0)
                FROM (
                    SELECT count(*) AS camera_count
                    FROM camera
                    WHERE tenant_id = ?
                    GROUP BY site_id
                ) site_camera_counts
                """, Long.class, tenantId);
        return value == null ? 0 : value;
    }

    private void assertWithinLimit(
            EntitlementMetric metric,
            String scope,
            LongSupplier currentUsageSupplier) {
        if (!featureProperties.isEnabled() || isPlatformAdmin()) {
            return;
        }
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new EntitlementCheckUnavailableException(
                    "Tenant context is required for entitlement enforcement");
        }
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new EntitlementCheckUnavailableException(
                    "Entitlement enforcement requires an active transaction");
        }

        try {
            acquireLock(tenantId, metric, scope);
            long currentUsage = currentUsageSupplier.getAsLong();
            OptionalLong limit = currentPlanLimit(tenantId, metric);
            if (limit.isPresent() && currentUsage + 1 > limit.getAsLong()) {
                throw new EntitlementExceededException(
                        metric.limitKey(), limit.getAsLong(), currentUsage, UPGRADE_URL);
            }
        } catch (EntitlementExceededException | EntitlementCheckUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new EntitlementCheckUnavailableException(
                    "Unable to verify entitlement " + metric.limitKey(), ex);
        }
    }

    private void acquireLock(UUID tenantId, EntitlementMetric metric, String scope) {
        String lockKey = tenantId + ":" + metric.limitKey() + ":" + scope;
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                rs -> { }, lockKey);
    }

    private OptionalLong currentPlanLimit(UUID tenantId, EntitlementMetric metric) {
        String limitsJson = jdbc.queryForObject("""
                SELECT p.limits::text
                FROM tenant t
                JOIN billing_plan p ON p.id = t.plan_id
                WHERE t.id = ?
                """, String.class, tenantId);
        if (limitsJson == null || limitsJson.isBlank()) {
            throw new EntitlementCheckUnavailableException("Billing plan limits are missing");
        }

        try {
            JsonNode value = objectMapper.readTree(limitsJson).get(metric.limitKey());
            if (value == null) {
                throw new EntitlementCheckUnavailableException(
                        "Billing plan does not define " + metric.limitKey());
            }
            if (value.isNull()) {
                return OptionalLong.empty();
            }
            if (!value.isIntegralNumber() || !value.canConvertToLong() || value.asLong() < 0) {
                throw new EntitlementCheckUnavailableException(
                        "Billing plan limit is invalid for " + metric.limitKey());
            }
            return OptionalLong.of(value.asLong());
        } catch (EntitlementCheckUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new EntitlementCheckUnavailableException(
                    "Could not parse billing limits for " + metric.limitKey(), ex);
        }
    }

    private boolean isPlatformAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_PLATFORM_ADMIN".equals(authority.getAuthority()));
    }
}
