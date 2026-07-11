package com.vehiclemanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TenantUpdateRequest(
        @NotBlank(message = "Tenant name is required")
        @Size(max = 150, message = "Tenant name must be at most 150 characters")
        String name) {
}
