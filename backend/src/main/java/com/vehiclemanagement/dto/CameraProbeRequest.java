package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CameraProbeRequest {

    /** Preferred field for both RTSP and HTTP (DroidCam) probes. */
    @Size(max = 500, message = "URL cannot exceed 500 characters")
    private String url;

    /** Legacy alias accepted by older clients. */
    @Size(max = 500, message = "RTSP URL cannot exceed 500 characters")
    private String rtspUrl;

    private Camera.SourceType sourceType;

    public String resolvedUrl() {
        if (url != null && !url.isBlank()) {
            return url.trim();
        }
        if (rtspUrl != null && !rtspUrl.isBlank()) {
            return rtspUrl.trim();
        }
        return null;
    }
}
