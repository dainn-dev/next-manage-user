package com.vehiclemanagement.dto;

import java.util.UUID;

/**
 * Wraps a {@link TenantDetailDto} with an audit reference so the frontend can
 * display a durable audit outcome after any lifecycle mutation.
 */
public record TenantMutationResponse(
        TenantDetailDto tenant,
        UUID auditId,
        String auditAction) {
}
