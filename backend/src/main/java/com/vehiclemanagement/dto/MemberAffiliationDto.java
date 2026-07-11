package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.MemberAffiliation;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class MemberAffiliationDto {
    private UUID userId;
    private UUID tenantId;
    private MemberAffiliation.Status status;
    private String username;
    private String email;
    private String fullName;
    private Instant createdAt;
    private Instant updatedAt;
}
