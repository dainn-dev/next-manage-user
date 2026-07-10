package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Site;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Tenant-scoped {@link Site} view. tenant_id is never exposed — it is enforced by
 * RLS and stamped by the DB session default (same convention as {@link GateDto}).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteDto {

    private UUID id;

    @NotBlank(message = "Site name is required")
    private String name;

    private String location;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SiteDto(Site site) {
        this.id = site.getId();
        this.name = site.getName();
        this.location = site.getLocation();
        this.createdAt = site.getCreatedAt();
        this.updatedAt = site.getUpdatedAt();
    }
}
