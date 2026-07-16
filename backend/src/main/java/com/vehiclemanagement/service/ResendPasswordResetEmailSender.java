package com.vehiclemanagement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
public class ResendPasswordResetEmailSender implements PasswordResetEmailSender {

    private final ResendProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ResendPasswordResetEmailSender(ResendProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    @Override
    public void sendPasswordReset(String recipientEmail, String resetUrl) {
        if (properties.getApiKey() == null || properties.getApiKey().isBlank()
                || properties.getFrom() == null || properties.getFrom().isBlank()) {
            throw new IllegalStateException("Password reset email delivery is not configured");
        }

        URI endpoint = URI.create(properties.getEndpoint());
        if (!"https".equalsIgnoreCase(endpoint.getScheme())) {
            throw new IllegalStateException("Password reset email endpoint must use HTTPS");
        }

        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "from", properties.getFrom(),
                    "to", new String[] { recipientEmail },
                    "subject", "Reset your password",
                    "html",
                    "<p>Use the link below to reset your password. It expires soon and can only be used once.</p>"
                            + "<p><a href=\"" + escapeHtml(resetUrl) + "\">Reset password</a></p>"));
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Password reset email delivery failed");
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Password reset email delivery failed", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Password reset email delivery interrupted", ex);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Password reset email delivery failed", ex);
        }
    }

    private String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
