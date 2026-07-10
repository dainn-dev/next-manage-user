package com.vehiclemanagement.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

@Service
public class StripeBillingClient {

    private final BillingProperties properties;
    private final ObjectMapper objectMapper;

    public StripeBillingClient(BillingProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public String createCustomer(UUID tenantId, String email) {
        requireSecretKey();
        try {
            Stripe.apiKey = properties.getSecretKey();
            CustomerCreateParams.Builder builder = CustomerCreateParams.builder()
                    .putMetadata("tenant_id", tenantId.toString());
            if (email != null && !email.isBlank()) {
                builder.setEmail(email);
            }
            return Customer.create(builder.build()).getId();
        } catch (StripeException ex) {
            throw new IllegalStateException("Unable to create Stripe customer", ex);
        }
    }

    public CheckoutSession createCheckoutSession(
            UUID tenantId,
            String stripeCustomerId,
            String stripePriceId,
            String successUrl,
            String cancelUrl) {
        requireSecretKey();
        try {
            Stripe.apiKey = properties.getSecretKey();
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(stripeCustomerId)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .putMetadata("tenant_id", tenantId.toString())
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(stripePriceId)
                            .setQuantity(1L)
                            .build())
                    .build();
            Session session = Session.create(params);
            return new CheckoutSession(session.getId(), session.getUrl());
        } catch (StripeException ex) {
            throw new IllegalStateException("Unable to create Stripe checkout session", ex);
        }
    }

    public PortalSession createPortalSession(String stripeCustomerId, String returnUrl) {
        requireSecretKey();
        try {
            Stripe.apiKey = properties.getSecretKey();
            com.stripe.param.billingportal.SessionCreateParams params =
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                            .setCustomer(stripeCustomerId)
                            .setReturnUrl(returnUrl)
                            .build();
            com.stripe.model.billingportal.Session session =
                    com.stripe.model.billingportal.Session.create(params);
            return new PortalSession(session.getId(), session.getUrl());
        } catch (StripeException ex) {
            throw new IllegalStateException("Unable to create Stripe billing portal session", ex);
        }
    }

    public BillingWebhookEvent parseWebhookEvent(String payload, String signature) {
        if (!properties.hasWebhookSecret()) {
            throw new IllegalStateException("Stripe webhook secret is not configured");
        }
        try {
            Event event = Webhook.constructEvent(payload, signature, properties.getWebhookSecret());
            JsonNode root = objectMapper.readTree(payload);
            JsonNode object = root.path("data").path("object");
            String type = event.getType();
            UUID tenantId = extractTenantId(object);
            String customerId = text(object, "customer");
            String subscriptionId = "customer.subscription.updated".equals(type)
                    ? text(object, "id")
                    : text(object, "subscription");
            if (subscriptionId == null) {
                subscriptionId = text(object.path("parent").path("subscription_details"), "subscription");
            }
            String status = text(object, "status");
            if ("checkout.session.completed".equals(type) && status == null) {
                status = "active";
            }
            return new BillingWebhookEvent(
                    event.getId(),
                    type,
                    tenantId,
                    customerId,
                    subscriptionId,
                    status,
                    epochSeconds(object, "current_period_end"),
                    extractPriceId(object));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid Stripe webhook event", ex);
        }
    }

    private UUID extractTenantId(JsonNode object) {
        String tenant = text(object.path("metadata"), "tenant_id");
        if (tenant == null) {
            tenant = text(object.path("subscription_details").path("metadata"), "tenant_id");
        }
        return tenant == null || tenant.isBlank() ? null : UUID.fromString(tenant);
    }

    private String extractPriceId(JsonNode object) {
        JsonNode item = object.path("items").path("data");
        if (item.isArray() && !item.isEmpty()) {
            return text(item.get(0).path("price"), "id");
        }
        return text(object.path("lines").path("data").path(0).path("price"), "id");
    }

    private OffsetDateTime epochSeconds(JsonNode object, String field) {
        JsonNode value = object.path(field);
        if (!value.isNumber()) {
            return null;
        }
        return OffsetDateTime.ofInstant(Instant.ofEpochSecond(value.asLong()), ZoneOffset.UTC);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() || value.asText().isBlank() ? null : value.asText();
    }

    private void requireSecretKey() {
        if (!properties.hasSecretKey()) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
    }

    public record CheckoutSession(String id, String url) {
    }

    public record PortalSession(String id, String url) {
    }
}
