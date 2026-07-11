package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.User;

import java.time.LocalDateTime;
import java.util.UUID;

public record TenantAdminSummaryDto(
        UUID id,
        String username,
        String email,
        String fullName,
        User.UserStatus status,
        LocalDateTime lastLogin) {
}
