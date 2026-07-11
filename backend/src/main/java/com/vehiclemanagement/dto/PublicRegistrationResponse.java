package com.vehiclemanagement.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class PublicRegistrationResponse {

    private UUID tenantId;
    private String tenantName;
    private String managementModel;
    private Integer areaCount;
    private UUID siteId;
    private String siteName;
    private UUID userId;
    private String username;
    private String email;
    private String role;
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private LocalDateTime expiresAt;
}
