package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.TenantStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record TenantDetailDto(
        UUID id,
        String name,
        String slug,
        TenantStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<TenantSiteSummaryDto> sites,
        List<TenantAdminSummaryDto> tenantAdmins) {
}
