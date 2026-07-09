package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantOnboardingRequest {

    @NotBlank(message = "Tenant name is required")
    @Size(max = 150, message = "Tenant name must be at most 150 characters")
    private String tenantName;

    @Size(max = 100, message = "Tenant slug must be at most 100 characters")
    private String tenantSlug;

    @NotBlank(message = "Site name is required")
    @Size(max = 150, message = "Site name must be at most 150 characters")
    private String siteName;

    @Size(max = 255, message = "Site location must be at most 255 characters")
    private String siteLocation;

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
