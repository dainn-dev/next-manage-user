package com.vehiclemanagement.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantSettingsUpdateRequest {

    @NotBlank(message = "Organization name is required")
    @Size(min = 2, max = 150, message = "Organization name must be between 2 and 150 characters")
    private String name;

    @NotBlank(message = "Management model is required")
    @Pattern(
            regexp = "boarding-house|school|retail|airport|hospital|industrial-park|other",
            message = "Management model is not supported")
    private String managementModel;

    @NotNull(message = "Area count is required")
    @Min(value = 1, message = "Area count must be at least 1")
    @Max(value = 999, message = "Area count must be at most 999")
    private Integer areaCount;
}
