package com.vehiclemanagement.integration;

import com.vehiclemanagement.billing.BillingService;
import com.vehiclemanagement.billing.BillingWebhookEvent;
import com.vehiclemanagement.billing.StripeBillingClient;
import com.vehiclemanagement.billing.dto.BillingCheckoutRequest;
import com.vehiclemanagement.billing.dto.BillingPortalRequest;
import com.vehiclemanagement.config.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class BillingLifecycleIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID TENANT_ID = UUID.fromString("20000000-0000-0000-0000-000000000275");
    private static final UUID STARTER_PLAN_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID PRO_PLAN_ID = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID OTHER_TENANT_ID = UUID.fromString("20000000-0000-0000-0000-000000000276");
    private static final OffsetDateTime EVENT_CREATED =
            OffsetDateTime.of(2026, 7, 10, 12, 0, 0, 0, ZoneOffset.UTC);

    @Autowired
    BillingService billingService;

    @Autowired
    JdbcTemplate jdbc;

    @MockBean
    StripeBillingClient stripeClient;

    @BeforeEach
    void resetBillingRows() {
        jdbc.update("DELETE FROM processed_stripe_event WHERE event_id LIKE 'evt_%_275'");
        jdbc.update("DELETE FROM billing_audit WHERE tenant_id = ?", TENANT_ID);
        jdbc.update("DELETE FROM billing_audit WHERE tenant_id = ?", OTHER_TENANT_ID);
        jdbc.update("DELETE FROM billing_subscription WHERE tenant_id = ?", TENANT_ID);
        jdbc.update("DELETE FROM billing_subscription WHERE tenant_id = ?", OTHER_TENANT_ID);
        jdbc.update("DELETE FROM tenant WHERE id = ?", TENANT_ID);
        jdbc.update("DELETE FROM tenant WHERE id = ?", OTHER_TENANT_ID);
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void checkoutCreatesStripeCustomerAndLocalIncompleteSubscription() {
        seedTenant();
        configureStripePrices();
        TenantContext.setTenantId(TENANT_ID);

        when(stripeClient.createCustomer(TENANT_ID, "tenant-admin@example.com")).thenReturn("cus_test_275");
        when(stripeClient.createCheckoutSession(eq(TENANT_ID), eq("cus_test_275"), eq("price_starter"),
                eq("https://app.example.test/success"), eq("https://app.example.test/cancel")))
                .thenReturn(new StripeBillingClient.CheckoutSession("cs_test_275", "https://checkout.stripe.test/cs_test_275"));

        BillingCheckoutRequest request = new BillingCheckoutRequest();
        request.setPlanId(STARTER_PLAN_ID);
        request.setSuccessUrl("https://app.example.test/success");
        request.setCancelUrl("https://app.example.test/cancel");

        var response = billingService.createCheckoutSession(request, "tenant-admin@example.com");

        assertThat(response.sessionId()).isEqualTo("cs_test_275");
        assertThat(response.url()).isEqualTo("https://checkout.stripe.test/cs_test_275");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM billing_subscription
                WHERE tenant_id = ? AND plan_id = ? AND stripe_customer_id = ? AND status = 'incomplete'
                """, Long.class, TENANT_ID, STARTER_PLAN_ID, "cus_test_275")).isEqualTo(1L);
    }

    @Test
    void portalUsesStoredStripeCustomer() {
        seedTenant();
        configureStripePrices();
        seedSubscription(STARTER_PLAN_ID, "cus_portal", "sub_portal", "active");
        TenantContext.setTenantId(TENANT_ID);

        when(stripeClient.createPortalSession("cus_portal", "https://app.example.test/billing"))
                .thenReturn(new StripeBillingClient.PortalSession("bps_test_275", "https://billing.stripe.test/session"));

        BillingPortalRequest request = new BillingPortalRequest();
        request.setReturnUrl("https://app.example.test/billing");

        var response = billingService.createPortalSession(request);

        assertThat(response.sessionId()).isEqualTo("bps_test_275");
        assertThat(response.url()).isEqualTo("https://billing.stripe.test/session");
    }

    @Test
    void webhookSyncsSubscriptionAndDeduplicatesStripeEvent() {
        seedTenant();
        configureStripePrices();
        seedSubscription(STARTER_PLAN_ID, "cus_sync", null, "incomplete");
        OffsetDateTime periodEnd = OffsetDateTime.of(2026, 8, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        when(stripeClient.parseWebhookEvent("payload", "sig")).thenReturn(new BillingWebhookEvent(
                "evt_sync_275",
                "customer.subscription.updated",
                TENANT_ID,
                "cus_sync",
                "sub_sync",
                "active",
                false,
                periodEnd,
                "price_pro",
                EVENT_CREATED));

        billingService.handleWebhook("payload", "sig");
        billingService.handleWebhook("payload", "sig");

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM processed_stripe_event WHERE event_id = 'evt_sync_275'
                """, Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("""
                SELECT plan_id FROM tenant WHERE id = ?
                """, UUID.class, TENANT_ID)).isEqualTo(PRO_PLAN_ID);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM billing_subscription
                WHERE tenant_id = ? AND plan_id = ? AND stripe_subscription_id = ? AND status = 'active'
                """, Long.class, TENANT_ID, PRO_PLAN_ID, "sub_sync")).isEqualTo(1L);
    }

    @Test
    void canceledWebhookDowngradesTenantToFreePlan() {
        seedTenant();
        configureStripePrices();
        seedSubscription(PRO_PLAN_ID, "cus_cancel", "sub_cancel", "active");
        when(stripeClient.parseWebhookEvent(any(), any())).thenReturn(new BillingWebhookEvent(
                "evt_cancel_275",
                "customer.subscription.updated",
                TENANT_ID,
                "cus_cancel",
                "sub_cancel",
                "canceled",
                false,
                null,
                null,
                EVENT_CREATED));

        billingService.handleWebhook("payload", "sig");

        assertThat(jdbc.queryForObject("SELECT code FROM billing_plan WHERE id = (SELECT plan_id FROM tenant WHERE id = ?)",
                String.class, TENANT_ID)).isEqualTo("free");
        assertThat(jdbc.queryForObject("SELECT status FROM billing_subscription WHERE tenant_id = ?",
                String.class, TENANT_ID)).isEqualTo("canceled");
    }

    @Test
    void failedPaymentEntersDunningAndReplayDoesNotDuplicateAudit() {
        seedTenant();
        configureStripePrices();
        seedSubscription(PRO_PLAN_ID, "cus_failed", "sub_failed", "active");
        when(stripeClient.parseWebhookEvent(any(), any())).thenReturn(new BillingWebhookEvent(
                "evt_failed_275",
                "invoice.payment_failed",
                TENANT_ID,
                "cus_failed",
                "sub_failed",
                null,
                false,
                null,
                null,
                EVENT_CREATED));

        billingService.handleWebhook("payload", "sig");
        billingService.handleWebhook("payload", "sig");

        assertThat(jdbc.queryForObject("""
                SELECT status FROM billing_subscription WHERE tenant_id = ?
                """, String.class, TENANT_ID)).isEqualTo("past_due");
        assertThat(jdbc.queryForObject("""
                SELECT past_due_since IS NOT NULL FROM billing_subscription WHERE tenant_id = ?
                """, Boolean.class, TENANT_ID)).isTrue();
        assertThat(jdbc.queryForObject("""
                SELECT code FROM billing_plan WHERE id = (SELECT plan_id FROM tenant WHERE id = ?)
                """, String.class, TENANT_ID)).isEqualTo("pro");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM billing_audit WHERE tenant_id = ? AND action = 'payment_failed'
                """, Long.class, TENANT_ID)).isEqualTo(1L);
    }

    @Test
    void paidInvoiceRecoversPastDueSubscriptionAndUpdatesPeriod() {
        seedTenant();
        configureStripePrices();
        seedSubscription(PRO_PLAN_ID, "cus_paid", "sub_paid", "past_due");
        OffsetDateTime periodEnd = OffsetDateTime.of(2026, 9, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        when(stripeClient.parseWebhookEvent(any(), any())).thenReturn(new BillingWebhookEvent(
                "evt_paid_275",
                "invoice.paid",
                TENANT_ID,
                "cus_paid",
                "sub_paid",
                "paid",
                false,
                periodEnd,
                "price_pro",
                EVENT_CREATED));

        billingService.handleWebhook("payload", "sig");

        assertThat(jdbc.queryForObject("""
                SELECT status FROM billing_subscription WHERE tenant_id = ?
                """, String.class, TENANT_ID)).isEqualTo("active");
        assertThat(jdbc.queryForObject("""
                SELECT current_period_end FROM billing_subscription WHERE tenant_id = ?
                """, OffsetDateTime.class, TENANT_ID)).isEqualTo(periodEnd);
        assertThat(jdbc.queryForObject("""
                SELECT past_due_since IS NULL FROM billing_subscription WHERE tenant_id = ?
                """, Boolean.class, TENANT_ID)).isTrue();
    }

    @Test
    void invoiceWithoutTenantMetadataResolvesOwnerThroughAdminPool() {
        seedTenant();
        seedSubscription(PRO_PLAN_ID, "cus_owner", "sub_owner", "active");
        when(stripeClient.parseWebhookEvent(any(), any())).thenReturn(new BillingWebhookEvent(
                "evt_owner_275",
                "invoice.payment_failed",
                null,
                "cus_owner",
                "sub_owner",
                null,
                false,
                null,
                null,
                EVENT_CREATED));

        billingService.handleWebhook("payload", "sig");

        assertThat(jdbc.queryForObject(
                "SELECT status FROM billing_subscription WHERE tenant_id = ?",
                String.class, TENANT_ID)).isEqualTo("past_due");
    }

    @Test
    void webhookRejectsMetadataThatConflictsWithIdentifierOwner() {
        seedTenant();
        seedOtherTenant();
        seedSubscription(OTHER_TENANT_ID, PRO_PLAN_ID, "cus_other", "sub_other", "active");
        when(stripeClient.parseWebhookEvent(any(), any())).thenReturn(new BillingWebhookEvent(
                "evt_mismatch_275",
                "invoice.payment_failed",
                TENANT_ID,
                "cus_other",
                "sub_other",
                null,
                false,
                null,
                null,
                EVENT_CREATED));

        assertThatThrownBy(() -> billingService.handleWebhook("payload", "sig"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM processed_stripe_event WHERE event_id = 'evt_mismatch_275'",
                Long.class)).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT status FROM billing_subscription WHERE tenant_id = ?",
                String.class, OTHER_TENANT_ID)).isEqualTo("active");
    }

    @Test
    void olderSubscriptionEventCannotOverwriteNewerState() {
        seedTenant();
        configureStripePrices();
        seedSubscription(PRO_PLAN_ID, "cus_order", "sub_order", "active");
        BillingWebhookEvent newerCanceled = new BillingWebhookEvent(
                "evt_newer_275", "customer.subscription.updated", TENANT_ID,
                "cus_order", "sub_order", "canceled", false, null, null,
                EVENT_CREATED.plusMinutes(5));
        BillingWebhookEvent olderActive = new BillingWebhookEvent(
                "evt_older_275", "customer.subscription.updated", TENANT_ID,
                "cus_order", "sub_order", "active", false, null, "price_pro",
                EVENT_CREATED);
        when(stripeClient.parseWebhookEvent("newer", "sig")).thenReturn(newerCanceled);
        when(stripeClient.parseWebhookEvent("older", "sig")).thenReturn(olderActive);

        billingService.handleWebhook("newer", "sig");
        billingService.handleWebhook("older", "sig");

        assertThat(jdbc.queryForObject(
                "SELECT status FROM billing_subscription WHERE tenant_id = ?",
                String.class, TENANT_ID)).isEqualTo("canceled");
        assertThat(jdbc.queryForObject(
                "SELECT code FROM billing_plan WHERE id = (SELECT plan_id FROM tenant WHERE id = ?)",
                String.class, TENANT_ID)).isEqualTo("free");
        assertThat(jdbc.queryForObject(
                "SELECT last_stripe_event_id FROM billing_subscription WHERE tenant_id = ?",
                String.class, TENANT_ID)).isEqualTo("evt_newer_275");
    }

    private void seedTenant() {
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status)
                VALUES (?, 'Billing Tenant', 'billing-tenant-275', 'active')
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
                """, TENANT_ID);
    }

    private void seedOtherTenant() {
        jdbc.update("""
                INSERT INTO tenant(id, name, slug, status)
                VALUES (?, 'Other Billing Tenant', 'billing-tenant-276', 'active')
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
                """, OTHER_TENANT_ID);
    }

    private void configureStripePrices() {
        jdbc.update("UPDATE billing_plan SET stripe_price_id = 'price_starter' WHERE id = ?", STARTER_PLAN_ID);
        jdbc.update("UPDATE billing_plan SET stripe_price_id = 'price_pro' WHERE id = ?", PRO_PLAN_ID);
    }

    private void seedSubscription(UUID planId, String customerId, String subscriptionId, String status) {
        seedSubscription(TENANT_ID, planId, customerId, subscriptionId, status);
    }

    private void seedSubscription(
            UUID tenantId, UUID planId, String customerId, String subscriptionId, String status) {
        jdbc.update("UPDATE tenant SET plan_id = ? WHERE id = ?", planId, tenantId);
        jdbc.update("""
                INSERT INTO billing_subscription(tenant_id, plan_id, stripe_customer_id, stripe_subscription_id, status)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (tenant_id) DO UPDATE
                SET plan_id = EXCLUDED.plan_id,
                    stripe_customer_id = EXCLUDED.stripe_customer_id,
                    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                    status = EXCLUDED.status
                """, tenantId, planId, customerId, subscriptionId, status);
    }
}
