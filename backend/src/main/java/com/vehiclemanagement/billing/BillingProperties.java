package com.vehiclemanagement.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "billing.stripe")
public class BillingProperties {

    private String secretKey = "";
    private String webhookSecret = "";
    private String publishableKey = "";

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public String getPublishableKey() {
        return publishableKey;
    }

    public void setPublishableKey(String publishableKey) {
        this.publishableKey = publishableKey;
    }

    public boolean hasSecretKey() {
        return secretKey != null && !secretKey.isBlank();
    }

    public boolean hasWebhookSecret() {
        return webhookSecret != null && !webhookSecret.isBlank();
    }
}
