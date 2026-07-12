package com.vehiclemanagement.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Payload accepted by the per-camera edge ingest endpoint. */
@Schema(description = "Camera event submitted to the durable edge ingest ledger")
public class CameraIngestRequest {

    @NotNull(message = "eventId is required")
    @Schema(description = "Client-generated idempotency key", requiredMode = Schema.RequiredMode.REQUIRED)
    private UUID eventId;

    /** Optional for newer edge clients; when supplied it must match the authenticated camera. */
    @Schema(description = "Optional camera identity echoed by the edge client")
    private UUID cameraId;

    @NotBlank(message = "event type is required")
    @Size(max = 40, message = "event type cannot exceed 40 characters")
    @JsonAlias("type")
    @Schema(description = "Detection or motion event type", requiredMode = Schema.RequiredMode.REQUIRED)
    private String eventType;

    @NotNull(message = "occurredAt is required")
    @Schema(description = "ISO-8601 time at which the event occurred", requiredMode = Schema.RequiredMode.REQUIRED)
    private OffsetDateTime occurredAt;

    @Schema(description = "Structured event payload")
    private JsonNode payload;

    @JsonIgnore
    private final Map<String, JsonNode> additionalFields = new LinkedHashMap<>();

    public CameraIngestRequest() {
    }

    @JsonAnySetter
    public void addAdditionalField(String name, JsonNode value) {
        additionalFields.put(name, value);
    }

    @JsonIgnore
    public Map<String, JsonNode> getAdditionalFields() {
        return additionalFields;
    }

    public UUID getEventId() {
        return eventId;
    }

    public void setEventId(UUID eventId) {
        this.eventId = eventId;
    }

    public UUID getCameraId() {
        return cameraId;
    }

    public void setCameraId(UUID cameraId) {
        this.cameraId = cameraId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public OffsetDateTime getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(OffsetDateTime occurredAt) {
        this.occurredAt = occurredAt;
    }

    public JsonNode getPayload() {
        return payload;
    }

    public void setPayload(JsonNode payload) {
        this.payload = payload;
    }
}
