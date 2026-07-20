package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantOnboardingRequest {

    @NotBlank(message = "Tenant name is required")
    @Size(max = 150, message = "Tenant name must be at most 150 characters")
    private String tenantName;

    @Size(max = 100, message = "Tenant slug must be at most 100 characters")
    private String tenantSlug;

    @NotBlank(message = "Operating facility name is required")
    @Size(max = 150, message = "Operating facility name must be at most 150 characters")
    private String facilityName;

    @Size(max = 255, message = "Operating facility location must be at most 255 characters")
    private String facilityLocation;

    @NotBlank(message = "Management model is required")
    @Pattern(
            regexp = "boarding-house|school|retail|airport|hospital|industrial-park|other",
            message = "Management model is not supported")
    private String managementModel;

    @NotNull(message = "Area count is required")
    @Min(value = 1, message = "Area count must be at least 1")
    @Max(value = 999, message = "Area count must be at most 999")
    private Integer areaCount;

    @NotBlank(message = "Admin username is required")
    @Size(min = 3, max = 50, message = "Admin username must be between 3 and 50 characters")
    private String adminUsername;

    @Email(message = "Admin email should be valid")
    @NotBlank(message = "Admin email is required")
    private String adminEmail;

    @NotBlank(message = "Admin password is required")
    @Size(min = 6, message = "Admin password must be at least 6 characters")
    private String adminPassword;

    private String adminFirstName;
    private String adminLastName;

    private User.Role adminRole;
}
