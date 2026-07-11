package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.TenantStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TenantStatusUpdateRequest(
        @NotNull(message = "Tenant status is required")
        TenantStatus status,
        @Size(max = 500, message = "Reason must be at most 500 characters")
        String reason) {
}
