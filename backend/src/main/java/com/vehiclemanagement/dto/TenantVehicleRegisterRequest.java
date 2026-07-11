package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Vehicle;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

/**
 * Ops "add plate to tenant management" (ADR-0604) — not platform vehicle CRUD.
 */
@Data
public class TenantVehicleRegisterRequest {

    @NotBlank
    private String licensePlate;

    /** Optional when creating a new platform vehicle row. */
    private Vehicle.VehicleType vehicleType;

    private String brand;
    private String model;
    private String color;
    private Integer year;

    /** Optional MEMBER owner; when set (or found on existing vehicle), affiliation is ensured. */
    private UUID ownerId;

    /** Optional branch for SITE_MANAGER scoping. */
    private UUID siteId;
}
