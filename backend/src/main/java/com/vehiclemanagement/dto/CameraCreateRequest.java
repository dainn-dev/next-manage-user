package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CameraCreateRequest {

    private UUID zoneId;

    @NotBlank(message = "Camera name is required")
    @Size(max = 150, message = "Camera name cannot exceed 150 characters")
    private String name;

    @Size(max = 500, message = "RTSP URL cannot exceed 500 characters")
    private String rtspUrl;

    private Camera.SourceType sourceType = Camera.SourceType.rtsp;

    @Size(max = 500, message = "Source URL cannot exceed 500 characters")
    private String sourceUrl;

    private Camera.CameraRole role = Camera.CameraRole.ANPR_GATE;

    private Camera.PanelType panelType;
}
