package com.vehiclemanagement.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Lifecycle settings for ADR-0602 per-camera credentials.
 */
@Component
@ConfigurationProperties(prefix = "camera-credentials")
public class CameraCredentialProperties {

    /**
     * How long the prior credential remains valid after rotation, allowing an
     * edge appliance to replace its local configuration without downtime.
     */
    private Duration rotationGracePeriod = Duration.ofHours(24);

    public Duration getRotationGracePeriod() {
        return rotationGracePeriod;
    }

    public void setRotationGracePeriod(Duration rotationGracePeriod) {
        this.rotationGracePeriod = rotationGracePeriod;
    }
}
