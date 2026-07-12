package com.vehiclemanagement.billing;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Resolves Stripe identifiers before a tenant context exists. */
@Service
public class BillingWebhookTenantResolver {

    private final JdbcTemplate jdbc;

    public BillingWebhookTenantResolver(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    public UUID resolve(BillingWebhookEvent event) {
        Set<UUID> owners = new LinkedHashSet<>();
        addOwners(owners, "stripe_customer_id", event.stripeCustomerId());
        addOwners(owners, "stripe_subscription_id", event.stripeSubscriptionId());
        if (owners.size() > 1) {
            throw new IllegalArgumentException("Stripe customer and subscription belong to different tenants");
        }

        UUID identifierOwner = owners.stream().findFirst().orElse(null);
        UUID metadataTenant = event.tenantId();
        if (metadataTenant != null) {
            if (!tenantExists(metadataTenant)) {
                throw new IllegalArgumentException("Stripe event references an unknown tenant");
            }
            if (identifierOwner != null && !metadataTenant.equals(identifierOwner)) {
                throw new IllegalArgumentException(
                        "Stripe event tenant metadata does not match its customer or subscription");
            }
            return metadataTenant;
        }
        if (identifierOwner == null) {
            throw new IllegalArgumentException("Stripe event does not identify a tenant");
        }
        return identifierOwner;
    }

    private void addOwners(Set<UUID> owners, String column, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        String sql = "SELECT DISTINCT tenant_id FROM billing_subscription WHERE " + column + " = ?";
        List<UUID> matches = jdbc.query(sql,
                (rs, rowNum) -> (UUID) rs.getObject("tenant_id"), value);
        owners.addAll(matches);
    }

    private boolean tenantExists(UUID tenantId) {
        Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM tenant WHERE id = ?)", Boolean.class, tenantId);
        return Boolean.TRUE.equals(exists);
    }
}
