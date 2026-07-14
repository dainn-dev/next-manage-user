package com.vehiclemanagement.billing;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;

/** Suspends tenants only when their payment grace period has elapsed. */
@Service
public class BillingDunningService {
    private final JdbcTemplate jdbc;
    private final Duration gracePeriod;
    private final BillingFeatureProperties featureProperties;

    public BillingDunningService(JdbcTemplate jdbc,
            @Value("${billing.dunning.grace-period:7d}") Duration gracePeriod,
            BillingFeatureProperties featureProperties) {
        this.jdbc = jdbc;
        this.gracePeriod = gracePeriod;
        this.featureProperties = featureProperties;
    }

    @Scheduled(fixedRateString = "${billing.dunning.check-rate-ms:60000}")
    @PlatformAdminOperation
    @Transactional
    public int suspendExpiredGracePeriods() {
        if (!featureProperties.isEnabled()) return 0;
        return jdbc.update("""
                UPDATE tenant tenant
                   SET status='suspended', billing_suspended_at=CURRENT_TIMESTAMP
                  FROM billing_subscription subscription
                 WHERE subscription.tenant_id=tenant.id
                   AND subscription.status='past_due'
                   AND subscription.past_due_since < ?
                   AND tenant.status='active'
                   AND tenant.billing_suspended_at IS NULL
                """, OffsetDateTime.now().minus(gracePeriod));
    }
}
