package com.vehiclemanagement.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Request to check if a vehicle is approved for entry/exit")
public class VehicleCheckRequest {

    @Schema(description = "Type of request: entry or exit", example = "entry", allowableValues = {"entry", "exit"})
    @NotNull(message = "Type is required")
    @NotBlank(message = "Type cannot be blank")
    private String type;

    @Schema(description = "License plate number of the vehicle", example = "76M5-1443")
    @NotNull(message = "License plate number is required")
    @NotBlank(message = "License plate number cannot be blank")
    private String licensePlateNumber;

    // Constructors
    public VehicleCheckRequest() {}

    public VehicleCheckRequest(String type, String licensePlateNumber) {
        this.type = type;
        this.licensePlateNumber = licensePlateNumber;
    }

    // Getters and Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getLicensePlateNumber() {
        return licensePlateNumber;
    }

    public void setLicensePlateNumber(String licensePlateNumber) {
        this.licensePlateNumber = licensePlateNumber;
    }
}
