package com.vehiclemanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Result of probing an RTSP camera source for reachability and stream metadata.
 * Soft diagnostic only — never blocks camera CRUD by itself.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CameraProbeResult {

    private boolean reachable;
    private boolean tcpOpen;
    private boolean streamOk;
    private String host;
    private Integer port;
    private String codec;
    private Integer width;
    private Integer height;
    private Double fps;
    private String probeMethod;
    private String errorCode;
    private String errorMessage;
    private LocalDateTime probedAt;
}
