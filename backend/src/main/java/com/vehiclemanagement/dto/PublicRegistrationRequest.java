package com.vehiclemanagement.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PublicRegistrationRequest {

    @NotBlank(message = "Organization name is required")
    @Size(min = 2, max = 80, message = "Organization name must be between 2 and 80 characters")
    private String organizationName;

    @NotBlank(message = "Management model is required")
    @Pattern(
            regexp = "boarding-house|school|retail|airport|hospital|industrial-park|other",
            message = "Management model is not supported")
    private String managementModel;

    @NotNull(message = "Area count is required")
    @Min(value = 1, message = "Area count must be at least 1")
    @Max(value = 999, message = "Area count must be at most 999")
    private Integer areaCount;

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 32, message = "Username must be between 3 and 32 characters")
    @Pattern(regexp = "[A-Za-z0-9._-]+", message = "Username may contain only letters, numbers, dots, underscores, and hyphens")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Email should be valid")
    @Size(max = 255, message = "Email must be at most 255 characters")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
    @Pattern(regexp = ".*[A-Za-z].*", message = "Password must contain at least one letter")
    @Pattern(regexp = ".*\\d.*", message = "Password must contain at least one number")
    private String password;
}
