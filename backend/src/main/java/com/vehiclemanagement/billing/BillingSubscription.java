package com.vehiclemanagement.billing;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BillingSubscription(
        UUID id,
        UUID tenantId,
        UUID planId,
        String stripeCustomerId,
        String stripeSubscriptionId,
        String status,
        OffsetDateTime currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        OffsetDateTime pastDueSince) {
}
