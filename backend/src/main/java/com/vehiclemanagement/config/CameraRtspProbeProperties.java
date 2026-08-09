package com.vehiclemanagement.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Timeouts and tooling for optional RTSP reachability probes during camera setup.
 */
@Component
@ConfigurationProperties(prefix = "camera.rtsp-probe")
public class CameraRtspProbeProperties {

    /** Overall wall-clock budget for a probe attempt. */
    private long timeoutMs = 8000;

    /** TCP connect timeout before declaring the host unreachable. */
    private long connectTimeoutMs = 3000;

    /**
     * Path to ffprobe. Empty/disabled skips the process-based probe and uses the
     * lightweight RTSP DESCRIBE fallback only.
     */
    private String ffprobePath = "ffprobe";

    public long getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(long timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public long getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(long connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public String getFfprobePath() {
        return ffprobePath;
    }

    public void setFfprobePath(String ffprobePath) {
        this.ffprobePath = ffprobePath;
    }
}
