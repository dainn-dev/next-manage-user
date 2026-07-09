package com.vehiclemanagement.config;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Resolves tenant scope for public edge/gate calls before their transactional
 * service work starts. The lookup uses the admin route because Deploy 2 has no
 * request tenant yet, so normal RLS-scoped reads would fail closed.
 */
@Component
public class EdgeTenantResolver {

    private final JdbcTemplate jdbc;

    public EdgeTenantResolver(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    public boolean bindFromGateId(UUID gateId) {
        if (TenantContext.isSet() || gateId == null) {
            return false;
        }
        return bind(resolveByGateId(gateId));
    }

    @PlatformAdminOperation
    public boolean bindFromGateName(String gateName) {
        if (TenantContext.isSet() || gateName == null || gateName.isBlank()) {
            return false;
        }
        return bind(resolveByGateName(gateName));
    }

    @PlatformAdminOperation
    public Optional<UUID> resolveByGateId(UUID gateId) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT tenant_id FROM gate WHERE id = ?",
                    UUID.class,
                    gateId));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    @PlatformAdminOperation
    public Optional<UUID> resolveByGateName(String gateName) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT tenant_id FROM gate WHERE name = ?",
                    UUID.class,
                    gateName));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    private boolean bind(Optional<UUID> tenantId) {
        tenantId.ifPresent(TenantContext::setTenantId);
        return tenantId.isPresent();
    }
}
