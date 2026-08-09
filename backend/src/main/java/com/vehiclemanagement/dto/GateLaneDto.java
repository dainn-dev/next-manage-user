package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** One lane on a gate — backed by a single camera row. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GateLaneDto {
    private UUID cameraId;
    private String name;
    private Camera.CameraStatus status;
    private Camera.PanelType panelType;
}
