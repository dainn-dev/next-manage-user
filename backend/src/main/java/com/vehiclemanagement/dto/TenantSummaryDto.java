package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.TenantStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record TenantSummaryDto(
        UUID id,
        String name,
        String slug,
        TenantStatus status,
        long siteCount,
        long tenantAdminCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
