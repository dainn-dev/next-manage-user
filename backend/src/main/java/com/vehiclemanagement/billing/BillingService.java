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
import java.util.LinkedHashMap;
import java.util.Map;
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
                    subscription == null ? "incomplete" : subscription.status(), subscription == null ? null : subscription.currentPeriodEnd(),
                    subscription != null && subscription.cancelAtPeriodEnd(), subscription == null ? null : subscription.pastDueSince());

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
        OffsetDateTime pastDueSince = "past_due".equals(status)
                ? findSubscriptionByTenant(tenantId)
                        .map(BillingSubscription::pastDueSince)
                        .orElseGet(OffsetDateTime::now)
                : null;
        upsertSubscription(tenantId, planId, event.stripeCustomerId(), event.stripeSubscriptionId(), status,
                event.currentPeriodEnd(), event.cancelAtPeriodEnd(), pastDueSince);
        if (shouldDowngradeToFree(status)) {
            jdbc.update("UPDATE tenant SET plan_id = ? WHERE id = ?", FREE_PLAN_ID, tenantId);
            audit(tenantId, "stripe_webhook", "downgraded_to_free", event,
                    Map.of("stripe_subscription_id", nullToEmpty(event.stripeSubscriptionId()), "status", status));
            return;
        }
        jdbc.update("UPDATE tenant SET plan_id = ? WHERE id = ?", planId, tenantId);
        audit(tenantId, "stripe_webhook", auditActionForSubscription(status), event,
                Map.of("stripe_subscription_id", nullToEmpty(event.stripeSubscriptionId()), "status", status));
    }

    private void markPaymentFailed(BillingWebhookEvent event) {
        UUID tenantId = requireTenant();
        jdbc.update("""
                UPDATE billing_subscription
                SET status = 'past_due',
                    past_due_since = COALESCE(past_due_since, CURRENT_TIMESTAMP),
                    current_period_end = COALESCE(?, current_period_end),
                    cancel_at_period_end = ?
                WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
                """, event.currentPeriodEnd(), event.cancelAtPeriodEnd(), event.stripeCustomerId(), event.stripeSubscriptionId());
        audit(tenantId, "stripe_webhook", "payment_failed", event,
                Map.of("stripe_customer_id", nullToEmpty(event.stripeCustomerId()),
                        "stripe_subscription_id", nullToEmpty(event.stripeSubscriptionId())));
    }

    private void syncInvoicePaid(BillingWebhookEvent event) {
        UUID tenantId = requireTenant();
        Optional<UUID> planId = planIdForEvent(event);
        if (planId.isPresent()) {
            jdbc.update("""
                    UPDATE billing_subscription
                    SET plan_id = ?,
                        status = CASE WHEN status = 'past_due' THEN 'active' ELSE status END,
                        current_period_end = COALESCE(?, current_period_end),
                        past_due_since = NULL
                    WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
                    """, planId.get(), event.currentPeriodEnd(), event.stripeCustomerId(), event.stripeSubscriptionId());
            jdbc.update("UPDATE tenant SET plan_id = ? WHERE id = ?", planId.get(), tenantId);
        } else {
            jdbc.update("""
                    UPDATE billing_subscription
                    SET status = CASE WHEN status = 'past_due' THEN 'active' ELSE status END,
                        current_period_end = COALESCE(?, current_period_end),
                        past_due_since = NULL
                    WHERE stripe_customer_id = ? OR stripe_subscription_id = ?
                    """, event.currentPeriodEnd(), event.stripeCustomerId(), event.stripeSubscriptionId());
        }
        audit(tenantId, "stripe_webhook", "invoice_paid", event,
                Map.of("stripe_subscription_id", nullToEmpty(event.stripeSubscriptionId())));
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

    private void upsertSubscription(UUID tenantId, UUID planId, String customerId, String subscriptionId, String status,
                                    OffsetDateTime currentPeriodEnd, boolean cancelAtPeriodEnd, OffsetDateTime pastDueSince) {
        if (customerId == null || customerId.isBlank()) {
            throw new IllegalArgumentException("Stripe customer id is required");
        }
        jdbc.update("""
                INSERT INTO billing_subscription(tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, past_due_since)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (tenant_id) DO UPDATE
                SET plan_id = EXCLUDED.plan_id,
                    stripe_customer_id = EXCLUDED.stripe_customer_id,
                    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, billing_subscription.stripe_subscription_id),
                    status = EXCLUDED.status,
                    current_period_end = COALESCE(EXCLUDED.current_period_end, billing_subscription.current_period_end),
                    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                    past_due_since = EXCLUDED.past_due_since
                """, tenantId, planId, customerId, subscriptionId, status, currentPeriodEnd, cancelAtPeriodEnd, pastDueSince);
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
                SELECT id, tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, past_due_since
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
                rs.getObject("current_period_end", OffsetDateTime.class),
                rs.getBoolean("cancel_at_period_end"),
                rs.getObject("past_due_since", OffsetDateTime.class));
    }

    private UUID requireTenant() {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new IllegalArgumentException("Tenant context is required for billing operations");
        }
        return tenantId;
    }

    private boolean shouldDowngradeToFree(String status) {
        return "canceled".equals(status) || "unpaid".equals(status) || "incomplete_expired".equals(status);
    }

    private String auditActionForSubscription(String status) {
        return switch (status) {
            case "active", "trialing" -> "subscription_activated";
            case "past_due" -> "payment_failed";
            case "canceled", "unpaid", "incomplete_expired" -> "downgraded_to_free";
            default -> "subscription_updated";
        };
    }

    private void audit(UUID tenantId, String actor, String action, BillingWebhookEvent event, Map<String, String> detail) {
        Map<String, String> auditDetail = new LinkedHashMap<>(detail);
        auditDetail.put("event_type", event.type());
        jdbc.update("""
                INSERT INTO billing_audit(tenant_id, actor, action, stripe_event_id, detail)
                VALUES (?, ?, ?, ?, ?::jsonb)
                """, tenantId, actor, action, event.id(), toJson(auditDetail));
    }

    private String toJson(Map<String, String> detail) {
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> entry : detail.entrySet()) {
            if (!first) {
                json.append(',');
            }
            json.append('"').append(escapeJson(entry.getKey())).append("\":\"")
                    .append(escapeJson(entry.getValue())).append('"');
            first = false;
        }
        return json.append('}').toString();
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
