package com.vehiclemanagement.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.repository.CameraRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

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
    private final SiteRepository siteRepository;
    private final CameraRepository cameraRepository;
    private final UserRepository userRepository;

    public EntitlementGuard(JdbcTemplate jdbc,
                            ObjectMapper objectMapper,
                            SiteRepository siteRepository,
                            CameraRepository cameraRepository,
                            UserRepository userRepository) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.siteRepository = siteRepository;
        this.cameraRepository = cameraRepository;
        this.userRepository = userRepository;
    }

    public void assertCameraCreationAllowed(UUID siteId) {
        assertWithinLimit(
                EntitlementMetric.MAX_CAMERAS_PER_SITE,
                () -> cameraRepository.countBySiteId(siteId));
    }

    public void assertSiteCreationAllowed() {
        assertWithinLimit(EntitlementMetric.MAX_SITES, siteRepository::count);
    }

    public void assertUserCreationAllowed() {
        assertWithinLimit(EntitlementMetric.USERS_PER_TENANT, userRepository::count);
    }

    public Map<String, Long> currentStructuralUsage() {
        Map<String, Long> usage = new LinkedHashMap<>();
        usage.put(EntitlementMetric.MAX_SITES.limitKey(), siteRepository.count());
        usage.put(EntitlementMetric.MAX_CAMERAS_PER_SITE.limitKey(), currentMaxCamerasPerSite());
        usage.put(EntitlementMetric.USERS_PER_TENANT.limitKey(), userRepository.count());
        return usage;
    }

    private long currentMaxCamerasPerSite() {
        Long value = jdbc.queryForObject("""
                SELECT COALESCE(MAX(camera_count), 0)
                FROM (
                    SELECT count(*) AS camera_count
                    FROM camera
                    GROUP BY site_id
                ) site_camera_counts
                """, Long.class);
        return value == null ? 0 : value;
    }

    private void assertWithinLimit(EntitlementMetric metric, LongSupplier currentUsageSupplier) {
        if (isPlatformAdmin()) {
            return;
        }
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            log.warn("Skipping entitlement check for {} because tenant context is not bound", metric.limitKey());
            return;
        }

        try {
            long currentUsage = currentUsageSupplier.getAsLong();
            OptionalLong limit = currentPlanLimit(tenantId, metric);
            if (limit.isPresent() && currentUsage + 1 > limit.getAsLong()) {
                throw new EntitlementExceededException(metric.limitKey(), limit.getAsLong(), currentUsage, UPGRADE_URL);
            }
        } catch (EntitlementExceededException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Entitlement lookup failed for tenant {} metric {}; allowing request",
                    tenantId, metric.limitKey(), ex);
        }
    }

    private OptionalLong currentPlanLimit(UUID tenantId, EntitlementMetric metric) {
        String limitsJson = jdbc.queryForObject("""
                SELECT p.limits::text
                FROM tenant t
                JOIN billing_plan p ON p.id = t.plan_id
                WHERE t.id = ?
                """, String.class, tenantId);
        if (limitsJson == null || limitsJson.isBlank()) {
            return OptionalLong.empty();
        }

        try {
            JsonNode value = objectMapper.readTree(limitsJson).get(metric.limitKey());
            if (value == null || value.isNull()) {
                return OptionalLong.empty();
            }
            return OptionalLong.of(value.asLong());
        } catch (Exception ex) {
            log.warn("Could not parse billing limits for tenant {} metric {}", tenantId, metric.limitKey(), ex);
            return OptionalLong.empty();
        }
    }

    private boolean isPlatformAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_PLATFORM_ADMIN".equals(authority.getAuthority()));
    }
}
