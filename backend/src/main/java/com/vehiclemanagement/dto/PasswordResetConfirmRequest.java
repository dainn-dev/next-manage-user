package com.vehiclemanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank(message = "Token is required")
        String token,
        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 100, message = "New password must be between 8 and 100 characters")
        @Pattern(regexp = ".*[A-Za-z].*", message = "New password must contain at least one letter")
        @Pattern(regexp = ".*\\d.*", message = "New password must contain at least one number")
        String newPassword) {
}
