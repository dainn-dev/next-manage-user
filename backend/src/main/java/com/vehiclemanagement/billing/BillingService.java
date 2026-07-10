package com.vehiclemanagement.billing;

import com.vehiclemanagement.billing.dto.BillingCheckoutRequest;
import com.vehiclemanagement.billing.dto.BillingCheckoutResponse;
import com.vehiclemanagement.billing.dto.BillingPortalRequest;
import com.vehiclemanagement.billing.dto.BillingPortalResponse;
import com.vehiclemanagement.billing.dto.BillingStatusResponse;
import com.vehiclemanagement.config.TenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class BillingService {

    private static final UUID FREE_PLAN_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactionTemplate;
    private final StripeBillingClient stripeClient;

    public BillingService(JdbcTemplate jdbc, TransactionTemplate transactionTemplate, StripeBillingClient stripeClient) {
        this.jdbc = jdbc;
        this.transactionTemplate = transactionTemplate;
        this.stripeClient = stripeClient;
    }

    public BillingCheckoutResponse createCheckoutSession(BillingCheckoutRequest request, String email) {
        UUID tenantId = requireTenant();
        return transactionTemplate.execute(status -> {
            BillingPlan plan = findPlan(request.getPlanId())
                    .filter(BillingPlan::active)
                    .orElseThrow(() -> new IllegalArgumentException("Billing plan is not available"));
            if (plan.stripePriceId() == null || plan.stripePriceId().isBlank()) {
                throw new IllegalArgumentException("Billing plan is not configured with a Stripe price");
            }
            BillingSubscription subscription = findSubscriptionByTenant(tenantId).orElse(null);
            String customerId = subscription == null
                    ? stripeClient.createCustomer(tenantId, email)
                    : subscription.stripeCustomerId();
            upsertSubscription(tenantId, plan.id(), customerId, subscription == null ? null : subscription.stripeSubscriptionId(),
                    subscription == null ? "incomplete" : subscription.status(), subscription == null ? null : subscription.currentPeriodEnd());

            StripeBillingClient.CheckoutSession session = stripeClient.createCheckoutSession(
                    tenantId, customerId, plan.stripePriceId(), request.getSuccessUrl(), request.getCancelUrl());
            return new BillingCheckoutResponse(session.id(), session.url());
        });
    }

    public BillingPortalResponse createPortalSession(BillingPortalRequest request) {
        UUID tenantId = requireTenant();
        BillingSubscription subscription = findSubscriptionByTenant(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant does not have a Stripe customer yet"));
        StripeBillingClient.PortalSession session = stripeClient.createPortalSession(
                subscription.stripeCustomerId(), request.getReturnUrl());
        return new BillingPortalResponse(session.id(), session.url());
    }

    public BillingStatusResponse getBillingStatus() {
        UUID tenantId = requireTenant();
        BillingPlan plan = jdbc.queryForObject("""
                SELECT p.id, p.code, p.name, p.limits::text, p.price_cents, p.currency, p.stripe_price_id, p.active
                FROM tenant t
                JOIN billing_plan p ON p.id = t.plan_id
                WHERE t.id = ?
                """, this::mapPlan, tenantId);
        BillingSubscription subscription = findSubscriptionByTenant(tenantId).orElse(null);
        return new BillingStatusResponse(
                plan.id(),
                plan.code(),
                plan.name(),
                plan.limits(),
                subscription == null ? null : subscription.status(),
                subscription == null ? null : subscription.currentPeriodEnd());
    }

    public void handleWebhook(String payload, String signature) {
        BillingWebhookEvent event = stripeClient.parseWebhookEvent(payload, signature);
        UUID tenantId = resolveTenantId(event);
        if (tenantId == null) {
            throw new IllegalArgumentException("Stripe event does not identify a tenant");
        }

        UUID previousTenant = TenantContext.getTenantId();
        TenantContext.setTenantId(tenantId);
        try {
            transactionTemplate.executeWithoutResult(status -> processWebhookEvent(tenantId, event));
        } finally {
            if (previousTenant == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenantId(previousTenant);
            }
        }
    }

    private void processWebhookEvent(UUID tenantId, BillingWebhookEvent event) {
        int inserted = jdbc.update("""
                INSERT INTO processed_stripe_event(event_id, event_type)
                VALUES (?, ?)
                ON CONFLICT (event_id) DO NOTHING
                """, event.id(), event.type());
        if (inserted == 0) {
            return;
        }

        switch (event.type()) {
            case "checkout.session.completed", "customer.subscription.updated" -> syncSubscription(tenantId, event);
            case "invoice.payment_failed" -> markPaymentFailed(event);
            case "invoice.paid" -> syncInvoicePaid(event);
            default -> {
            }
        }
    }

    private void syncSubscription(UUID tenantId, BillingWebhookEvent event) {
        UUID planId = planIdForEvent(event).orElse(null);
        if (planId == null && "canceled".equals(event.status())) {
            planId = FREE_PLAN_ID;
        }
        if (planId == null) {
            planId = findSubscriptionByTenant(tenantId).map(BillingSubscription::planId).orElse(FREE_PLAN_ID);
        }
        String status = event.status() == null ? "active" : event.status();
        upsertSubscription(tenantId, planId, event.stripeCustomerId(), event.stripeSubscriptionId(), status, event.currentPeriodEnd());
        jdbc.update("UPDATE tenant SET plan_id = ? WHERE id = ?", planId, tenantId);
    }

    private void markPaymentFailed(BillingWebhookEvent event) {
        jdbc.update("""
                UPDATE billing_subscription
                SET status = 'past_due'
                WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
                """, event.stripeCustomerId(), event.stripeSubscriptionId());
    }

    private void syncInvoicePaid(BillingWebhookEvent event) {
        if (event.currentPeriodEnd() == null) {
            return;
        }
        jdbc.update("""
                UPDATE billing_subscription
                SET current_period_end = ?
                WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
                """, event.currentPeriodEnd(), event.stripeCustomerId(), event.stripeSubscriptionId());
    }

    private Optional<UUID> planIdForEvent(BillingWebhookEvent event) {
        if (event.stripePriceId() == null) {
            return Optional.empty();
        }
        return jdbc.query("""
                SELECT id FROM billing_plan WHERE stripe_price_id = ?
                """, (rs, rowNum) -> (UUID) rs.getObject("id"), event.stripePriceId()).stream().findFirst();
    }

    private UUID resolveTenantId(BillingWebhookEvent event) {
        if (event.tenantId() != null) {
            return event.tenantId();
        }
        return jdbc.query("""
                SELECT tenant_id FROM billing_subscription
                WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
                """, (rs, rowNum) -> (UUID) rs.getObject("tenant_id"), event.stripeCustomerId(), event.stripeSubscriptionId())
                .stream()
                .findFirst()
                .orElse(null);
    }

    private void upsertSubscription(UUID tenantId, UUID planId, String customerId, String subscriptionId, String status, OffsetDateTime currentPeriodEnd) {
        if (customerId == null || customerId.isBlank()) {
            throw new IllegalArgumentException("Stripe customer id is required");
        }
        jdbc.update("""
                INSERT INTO billing_subscription(tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (tenant_id) DO UPDATE
                SET plan_id = EXCLUDED.plan_id,
                    stripe_customer_id = EXCLUDED.stripe_customer_id,
                    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, billing_subscription.stripe_subscription_id),
                    status = EXCLUDED.status,
                    current_period_end = COALESCE(EXCLUDED.current_period_end, billing_subscription.current_period_end)
                """, tenantId, planId, customerId, subscriptionId, status, currentPeriodEnd);
    }

    private Optional<BillingPlan> findPlan(UUID planId) {
        return jdbc.query("""
                SELECT id, code, name, limits::text, price_cents, currency, stripe_price_id, active
                FROM billing_plan
                WHERE id = ?
                """, this::mapPlan, planId).stream().findFirst();
    }

    private Optional<BillingSubscription> findSubscriptionByTenant(UUID tenantId) {
        return jdbc.query("""
                SELECT id, tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end
                FROM billing_subscription
                WHERE tenant_id = ?
                """, this::mapSubscription, tenantId).stream().findFirst();
    }

    private BillingPlan mapPlan(ResultSet rs, int rowNum) throws SQLException {
        return new BillingPlan(
                (UUID) rs.getObject("id"),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("limits"),
                rs.getInt("price_cents"),
                rs.getString("currency"),
                rs.getString("stripe_price_id"),
                rs.getBoolean("active"));
    }

    private BillingSubscription mapSubscription(ResultSet rs, int rowNum) throws SQLException {
        return new BillingSubscription(
                (UUID) rs.getObject("id"),
                (UUID) rs.getObject("tenant_id"),
                (UUID) rs.getObject("plan_id"),
                rs.getString("stripe_customer_id"),
                rs.getString("stripe_subscription_id"),
                rs.getString("status"),
                rs.getObject("current_period_end", OffsetDateTime.class));
    }

    private UUID requireTenant() {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalArgumentException("Tenant context is required for billing operations");
        }
        return tenantId;
    }
}
