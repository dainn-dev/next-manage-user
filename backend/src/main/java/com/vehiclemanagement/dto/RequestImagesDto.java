package com.vehiclemanagement.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Images associated with an entry/exit request")
public class RequestImagesDto {

    @Schema(description = "Request ID")
    private String requestId;

    @Schema(description = "License plate number")
    private String licensePlate;

    @Schema(description = "Path to entry image", example = "/images/entry/76M5-1443_2025-09-14_23-45-30.jpg")
    private String entryImagePath;

    @Schema(description = "Path to exit image", example = "/images/exit/76M5-1443_2025-09-14_23-45-30.jpg")
    private String exitImagePath;

    @Schema(description = "Whether entry image exists")
    private boolean hasEntryImage;

    @Schema(description = "Whether exit image exists")
    private boolean hasExitImage;

    // Constructors
    public RequestImagesDto() {}

    public RequestImagesDto(String requestId, String licensePlate, String entryImagePath, String exitImagePath) {
        this.requestId = requestId;
        this.licensePlate = licensePlate;
        this.entryImagePath = entryImagePath;
        this.exitImagePath = exitImagePath;
        this.hasEntryImage = entryImagePath != null && !entryImagePath.isEmpty();
        this.hasExitImage = exitImagePath != null && !exitImagePath.isEmpty();
    }

    // Getters and Setters
    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getLicensePlate() {
        return licensePlate;
    }

    public void setLicensePlate(String licensePlate) {
        this.licensePlate = licensePlate;
    }

    public String getEntryImagePath() {
        return entryImagePath;
    }

    public void setEntryImagePath(String entryImagePath) {
        this.entryImagePath = entryImagePath;
        this.hasEntryImage = entryImagePath != null && !entryImagePath.isEmpty();
    }

    public String getExitImagePath() {
        return exitImagePath;
    }

    public void setExitImagePath(String exitImagePath) {
        this.exitImagePath = exitImagePath;
        this.hasExitImage = exitImagePath != null && !exitImagePath.isEmpty();
    }

    public boolean isHasEntryImage() {
        return hasEntryImage;
    }

    public void setHasEntryImage(boolean hasEntryImage) {
        this.hasEntryImage = hasEntryImage;
    }

    public boolean isHasExitImage() {
        return hasExitImage;
    }

    public void setHasExitImage(boolean hasExitImage) {
        this.hasExitImage = hasExitImage;
    }
}
