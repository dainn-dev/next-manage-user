package com.vehiclemanagement.parking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class OpenParkingSessionRequest {
    @NotNull
    private UUID siteId;
    @NotBlank
    private String licensePlate;
    private UUID gateInId;
}
