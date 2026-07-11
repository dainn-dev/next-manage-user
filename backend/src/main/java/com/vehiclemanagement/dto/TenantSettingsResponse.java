package com.vehiclemanagement.dto;

import java.util.UUID;

/**
 * Own-tenant profile for TENANT_ADMIN settings. Slug/status are read-only
 * (lifecycle is PLATFORM_ADMIN); managementModel/areaCount are registration intent.
 */
public record TenantSettingsResponse(
        UUID id,
        String name,
        String slug,
        String status,
        String managementModel,
        Integer areaCount,
        long siteCount,
        String planCode,
        String planName) {
}
