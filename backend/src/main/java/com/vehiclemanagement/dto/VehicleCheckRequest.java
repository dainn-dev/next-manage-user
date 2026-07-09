package com.vehiclemanagement.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

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

    @Schema(description = "Optional id of the gate the request originated from. When present the "
            + "resulting log is tagged with the gate and the event is also published to the "
            + "per-gate WebSocket topic. Omit for backward-compatible behaviour.",
            example = "b3f1a2c4-5d6e-7f80-9a0b-1c2d3e4f5061")
    private UUID gateId;

    @Schema(description = "Optional client-generated idempotency key (UUID) for the detection "
            + "event. The edge sends the same eventId when it retries a store-and-forward event, "
            + "so the backend can return the original result instead of processing it twice "
            + "(Phase 4.3). Omit for one-shot callers.",
            example = "d1f9c2a0-6b3e-4c8a-9f21-0a1b2c3d4e5f")
    private String eventId;

    @Schema(description = "Optional ISO-8601 timestamp of when the detection actually occurred at "
            + "the edge. Sent so a delayed store-and-forward retry reflects the real event time "
            + "rather than the resend time. Currently informational.",
            example = "2026-07-09T10:20:30.123456+00:00")
    private String occurredAt;

    // Constructors
    public VehicleCheckRequest() {}

    public VehicleCheckRequest(String type, String licensePlateNumber) {
        this.type = type;
        this.licensePlateNumber = licensePlateNumber;
    }

    public VehicleCheckRequest(String type, String licensePlateNumber, UUID gateId) {
        this.type = type;
        this.licensePlateNumber = licensePlateNumber;
        this.gateId = gateId;
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

    public UUID getGateId() {
        return gateId;
    }

    public void setGateId(UUID gateId) {
        this.gateId = gateId;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(String occurredAt) {
        this.occurredAt = occurredAt;
    }
}
