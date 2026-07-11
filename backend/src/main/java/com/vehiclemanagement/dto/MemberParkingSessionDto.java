package com.vehiclemanagement.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class MemberParkingSessionDto {
    private UUID sessionId;
    private UUID tenantId;
    private String tenantName;
    private UUID siteId;
    private String licensePlate;
    private String status;
    private Instant startedAt;
    private Instant endedAt;
    private String qrTokenJti;
    /** Slot / bay address when lot cameras have assigned one (future). */
    private String locationLabel;
}
