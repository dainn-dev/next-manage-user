package com.vehiclemanagement.billing;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BillingWebhookEvent(
        String id,
        String type,
        UUID tenantId,
        String stripeCustomerId,
        String stripeSubscriptionId,
        String status,
        boolean cancelAtPeriodEnd,
        OffsetDateTime currentPeriodEnd,
        String stripePriceId,
        OffsetDateTime createdAt) {

    /** Backward-compatible constructor for callers that do not provide event creation time. */
    public BillingWebhookEvent(String id,
                               String type,
                               UUID tenantId,
                               String stripeCustomerId,
                               String stripeSubscriptionId,
                               String status,
                               boolean cancelAtPeriodEnd,
                               OffsetDateTime currentPeriodEnd,
                               String stripePriceId) {
        this(id, type, tenantId, stripeCustomerId, stripeSubscriptionId, status,
                cancelAtPeriodEnd, currentPeriodEnd, stripePriceId, null);
    }
}
