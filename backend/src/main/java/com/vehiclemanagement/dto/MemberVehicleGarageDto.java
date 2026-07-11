package com.vehiclemanagement.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class MemberVehicleGarageDto {
    private UUID vehicleId;
    private String licensePlate;
    private String vehicleType;
    private String brand;
    private String model;
    private String color;
    private String status;
    private List<RegistrationOrg> registeredAt;

    @Data
    @Builder
    public static class RegistrationOrg {
        private UUID tenantId;
        private String tenantName;
        private UUID siteId;
        private String status;
    }
}
