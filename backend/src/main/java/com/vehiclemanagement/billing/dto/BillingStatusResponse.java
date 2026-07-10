package com.vehiclemanagement.billing.dto;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record BillingStatusResponse(
        UUID planId,
        String planCode,
        String planName,
        String limits,
        Map<String, Long> usage,
        String subscriptionStatus,
        OffsetDateTime currentPeriodEnd) {
}
