package com.vehiclemanagement.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Response for vehicle entry/exit check")
public class VehicleCheckResponse {

    @Schema(description = "Whether the vehicle is approved for the requested action", example = "true")
    private boolean approved;

    @Schema(description = "Message describing the result", example = "Xe có biển kiểm soát 76M5-1443 được phép ra")
    private String message;

    @Schema(description = "License plate number of the checked vehicle", example = "76M5-1443")
    private String licensePlateNumber;

    @Schema(description = "Type of request that was checked", example = "exit")
    private String type;

    @Schema(description = "Path to the uploaded image", example = "/images/entry/76M5-1443_2025-09-14_23-45-30.jpg")
    private String imagePath;

    @Schema(description = "Fine-grained outcome of the check. APPROVED lets the vehicle through; "
            + "DENIED blocks it; PENDING means an unregistered plate was queued for approval "
            + "and the gate must NOT open automatically (Phase 4.4).", example = "PENDING")
    private CheckResult result;

    /** Outcome of an access check. {@code approved} stays a coarse boolean for backward compatibility. */
    public enum CheckResult {
        APPROVED, DENIED, PENDING
    }

    // Constructors
    public VehicleCheckResponse() {}

    public VehicleCheckResponse(boolean approved, String message, String licensePlateNumber, String type) {
        this.approved = approved;
        this.message = message;
        this.licensePlateNumber = licensePlateNumber;
        this.type = type;
        this.result = approved ? CheckResult.APPROVED : CheckResult.DENIED;
    }

    public VehicleCheckResponse(boolean approved, String message, String licensePlateNumber, String type, String imagePath) {
        this.approved = approved;
        this.message = message;
        this.licensePlateNumber = licensePlateNumber;
        this.type = type;
        this.imagePath = imagePath;
        this.result = approved ? CheckResult.APPROVED : CheckResult.DENIED;
    }

    // Getters and Setters
    public boolean isApproved() {
        return approved;
    }

    public void setApproved(boolean approved) {
        this.approved = approved;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getLicensePlateNumber() {
        return licensePlateNumber;
    }

    public void setLicensePlateNumber(String licensePlateNumber) {
        this.licensePlateNumber = licensePlateNumber;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getImagePath() {
        return imagePath;
    }

    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
    }

    public CheckResult getResult() {
        return result;
    }

    public void setResult(CheckResult result) {
        this.result = result;
    }
}
