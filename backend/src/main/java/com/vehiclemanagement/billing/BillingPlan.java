package com.vehiclemanagement.billing;

import java.util.UUID;

public record BillingPlan(
        UUID id,
        String code,
        String name,
        String limits,
        Integer priceCents,
        String currency,
        String stripePriceId,
        boolean active) {
}
