package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Zone;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Tenant-scoped {@link Zone} view. A zone belongs to exactly one {@link Site}; the
 * site itself is confined to the current tenant by RLS, so no tenant_id is exposed.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ZoneDto {

    private UUID id;

    @NotNull(message = "siteId is required")
    private UUID siteId;

    @NotBlank(message = "Zone name is required")
    private String name;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public ZoneDto(Zone zone) {
        this.id = zone.getId();
        this.siteId = zone.getSiteId();
        this.name = zone.getName();
        this.createdAt = zone.getCreatedAt();
        this.updatedAt = zone.getUpdatedAt();
    }
}
