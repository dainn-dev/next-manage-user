package com.vehiclemanagement.billing;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StripeBillingClientTest {

    private static final String WEBHOOK_SECRET = "whsec_test_billing_secret";
    private static final UUID TENANT_ID =
            UUID.fromString("30000000-0000-0000-0000-000000000275");

    @Test
    void signedWebhookIsVerifiedAndCreatedTimeIsParsed() throws Exception {
        long created = Instant.parse("2026-07-10T12:00:00Z").getEpochSecond();
        String payload = """
                {
                  "id":"evt_signed_275",
                  "object":"event",
                  "created":%d,
                  "livemode":false,
                  "pending_webhooks":1,
                  "type":"customer.subscription.updated",
                  "data":{"object":{
                    "id":"sub_signed",
                    "object":"subscription",
                    "customer":"cus_signed",
                    "status":"active",
                    "metadata":{"tenant_id":"%s"}
                  }}
                }
                """.formatted(created, TENANT_ID);
        BillingProperties properties = new BillingProperties();
        properties.setWebhookSecret(WEBHOOK_SECRET);
        StripeBillingClient client = new StripeBillingClient(properties, new ObjectMapper());

        BillingWebhookEvent event = client.parseWebhookEvent(
                payload, signatureHeader(created, payload, WEBHOOK_SECRET));

        assertThat(event.id()).isEqualTo("evt_signed_275");
        assertThat(event.tenantId()).isEqualTo(TENANT_ID);
        assertThat(event.createdAt()).isEqualTo(
                OffsetDateTime.ofInstant(Instant.ofEpochSecond(created), ZoneOffset.UTC));
    }

    @Test
    void invalidSignatureIsRejected() {
        BillingProperties properties = new BillingProperties();
        properties.setWebhookSecret(WEBHOOK_SECRET);
        StripeBillingClient client = new StripeBillingClient(properties, new ObjectMapper());

        assertThatThrownBy(() -> client.parseWebhookEvent("{}", "t=1,v1=invalid"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid Stripe webhook event");
    }

    @Test
    void missingWebhookSecretIsRejected() {
        StripeBillingClient client = new StripeBillingClient(new BillingProperties(), new ObjectMapper());

        assertThatThrownBy(() -> client.parseWebhookEvent("{}", "t=1,v1=invalid"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not configured");
    }

    private String signatureHeader(long timestamp, String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8));
        return "t=" + timestamp + ",v1=" + HexFormat.of().formatHex(digest);
    }
}
