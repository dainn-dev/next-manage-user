package com.vehiclemanagement.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class TenantOnboardingResponse {

    private UUID tenantId;
    private String tenantName;
    private String tenantSlug;
    private UUID adminUserId;
    private String adminUsername;
    private String adminEmail;
    private String role;
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private LocalDateTime expiresAt;
}
