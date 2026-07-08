package com.vehiclemanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.UUID;

/**
 * Edge gate self-registration payload. The gate is upserted by {@code id} when
 * provided, otherwise by unique {@code name}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateRegisterRequest {

    private UUID id;

    @NotBlank(message = "Gate name is required")
    @Size(max = 100, message = "Gate name cannot exceed 100 characters")
    private String name;

    @Size(max = 255, message = "Location cannot exceed 255 characters")
    private String location;

    @Size(max = 500, message = "Camera RTSP URL cannot exceed 500 characters")
    private String cameraRtspUrl;
}
