package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.TenantVehicleRegistration;
import com.vehiclemanagement.entity.Vehicle;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class TenantVehicleRegistrationDto {
    private UUID vehicleId;
    private UUID tenantId;
    private UUID siteId;
    private String status;
    private String licensePlate;
    private UUID ownerId;
    private String ownerUsername;
    private boolean linkedExisting;
    private LocalDateTime createdAt;

    public static TenantVehicleRegistrationDto from(
            TenantVehicleRegistration reg, Vehicle vehicle, boolean linkedExisting) {
        return TenantVehicleRegistrationDto.builder()
                .vehicleId(reg.getId().getVehicleId())
                .tenantId(reg.getId().getTenantId())
                .siteId(reg.getSiteId())
                .status(reg.getStatus().name())
                .licensePlate(vehicle != null ? vehicle.getLicensePlate() : null)
                .ownerId(vehicle != null && vehicle.getOwner() != null ? vehicle.getOwner().getId() : null)
                .ownerUsername(vehicle != null && vehicle.getOwner() != null
                        ? vehicle.getOwner().getUsername() : null)
                .linkedExisting(linkedExisting)
                .createdAt(reg.getCreatedAt())
                .build();
    }
}
