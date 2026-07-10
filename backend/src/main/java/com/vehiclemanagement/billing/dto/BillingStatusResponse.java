package com.vehiclemanagement.billing.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BillingStatusResponse(
        UUID planId,
        String planCode,
        String planName,
        String limits,
        String subscriptionStatus,
        OffsetDateTime currentPeriodEnd) {
}
