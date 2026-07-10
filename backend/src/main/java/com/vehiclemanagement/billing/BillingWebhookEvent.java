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
        OffsetDateTime currentPeriodEnd,
        String stripePriceId) {
}
