package com.vehiclemanagement.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record TenantSiteSummaryDto(
        UUID id,
        String name,
        String location,
        LocalDateTime createdAt) {
}
