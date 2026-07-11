package com.vehiclemanagement.dto;

public record TenantStatisticsResponse(
        long total,
        long active,
        long suspended,
        long pendingDeletion) {
}
