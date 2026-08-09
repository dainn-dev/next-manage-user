package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Gate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Admin gate creation payload. Unlike edge self-registration, this always creates
 * a new row and requires an operating facility ({@code siteId}).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateCreateRequest {

    @NotNull(message = "Site ID is required")
    private UUID siteId;

    @NotBlank(message = "Gate name is required")
    @Size(max = 100, message = "Gate name cannot exceed 100 characters")
    private String name;

    @Size(max = 255, message = "Location cannot exceed 255 characters")
    private String location;

    @Size(max = 500, message = "Camera RTSP URL cannot exceed 500 characters")
    private String cameraRtspUrl;

    /** Optional; defaults to {@code offline} when omitted. */
    private Gate.GateStatus status;
}
