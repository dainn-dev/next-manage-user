package com.vehiclemanagement.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "registration.rate-limit")
public class RegistrationRateLimitProperties {

    private boolean enabled = true;
    private int capacity = 5;
    private Duration refillPeriod = Duration.ofMinutes(15);
    private Duration bucketExpiry = Duration.ofHours(1);
    private int maximumTrackedIps = 10_000;
    private boolean trustForwardedHeaders;
    private List<String> trustedProxies = new ArrayList<>();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public Duration getRefillPeriod() {
        return refillPeriod;
    }

    public void setRefillPeriod(Duration refillPeriod) {
        this.refillPeriod = refillPeriod;
    }

    public Duration getBucketExpiry() {
        return bucketExpiry;
    }

    public void setBucketExpiry(Duration bucketExpiry) {
        this.bucketExpiry = bucketExpiry;
    }

    public int getMaximumTrackedIps() {
        return maximumTrackedIps;
    }

    public void setMaximumTrackedIps(int maximumTrackedIps) {
        this.maximumTrackedIps = maximumTrackedIps;
    }

    public boolean isTrustForwardedHeaders() {
        return trustForwardedHeaders;
    }

    public void setTrustForwardedHeaders(boolean trustForwardedHeaders) {
        this.trustForwardedHeaders = trustForwardedHeaders;
    }

    public List<String> getTrustedProxies() {
        return trustedProxies;
    }

    public void setTrustedProxies(List<String> trustedProxies) {
        this.trustedProxies = trustedProxies == null ? new ArrayList<>() : new ArrayList<>(trustedProxies);
    }
}
