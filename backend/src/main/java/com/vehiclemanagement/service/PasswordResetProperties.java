package com.vehiclemanagement.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "password-reset")
public class PasswordResetProperties {

    private Duration tokenTtl = Duration.ofMinutes(30);
    private Duration rateLimitWindow = Duration.ofHours(1);
    private int emailLimit = 3;
    private int ipLimit = 10;
    private String fingerprintSecret = "change-me-password-reset-fingerprint-secret";
    private String resetUrl = "http://localhost:3000/reset-password";

    public Duration getTokenTtl() {
        return tokenTtl;
    }

    public void setTokenTtl(Duration tokenTtl) {
        this.tokenTtl = tokenTtl;
    }

    public Duration getRateLimitWindow() {
        return rateLimitWindow;
    }

    public void setRateLimitWindow(Duration rateLimitWindow) {
        this.rateLimitWindow = rateLimitWindow;
    }

    public int getEmailLimit() {
        return emailLimit;
    }

    public void setEmailLimit(int emailLimit) {
        this.emailLimit = emailLimit;
    }

    public int getIpLimit() {
        return ipLimit;
    }

    public void setIpLimit(int ipLimit) {
        this.ipLimit = ipLimit;
    }

    public String getFingerprintSecret() {
        return fingerprintSecret;
    }

    public void setFingerprintSecret(String fingerprintSecret) {
        this.fingerprintSecret = fingerprintSecret;
    }

    public String getResetUrl() {
        return resetUrl;
    }

    public void setResetUrl(String resetUrl) {
        this.resetUrl = resetUrl;
    }

    public void validate() {
        if (fingerprintSecret == null || fingerprintSecret.length() < 32) {
            throw new IllegalStateException("PASSWORD_RESET_FINGERPRINT_SECRET must contain at least 32 characters");
        }
        if (tokenTtl == null || tokenTtl.isZero() || tokenTtl.isNegative()) {
            throw new IllegalStateException("password-reset.token-ttl must be positive");
        }
        if (rateLimitWindow == null || rateLimitWindow.isZero() || rateLimitWindow.isNegative()) {
            throw new IllegalStateException("password-reset.rate-limit-window must be positive");
        }
        if (emailLimit < 1 || ipLimit < 1) {
            throw new IllegalStateException("password-reset limits must be positive");
        }
        if (resetUrl == null || resetUrl.isBlank()) {
            throw new IllegalStateException("password-reset.reset-url must be configured");
        }
    }
}
