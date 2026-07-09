package com.vehiclemanagement.config;

import java.util.UUID;

/**
 * Request-scoped tenant identity for the current thread.
 *
 * <p>The value set here is pushed to the PostgreSQL session variable
 * {@code app.tenant_id} at transaction begin by
 * {@link TenantRoutingJpaTransactionManager}, which is what the Deploy 2
 * Row-Level Security policies read. This holder only carries the identity; it
 * does not itself enforce isolation.
 *
 * <p>{@link #getTenantId()} returns {@code null} when nothing was bound (e.g. a
 * legacy token with no {@code tenant_id} claim, or a non-request transaction
 * such as startup seeding). The fallback policy for an unbound context lives in
 * one place — {@link TenantRoutingJpaTransactionManager} — so the two-deploy
 * transition can flip it with a single flag
 * ({@code multitenancy.default-tenant-fallback}): {@code true} in Deploy 1
 * (unbound → {@link #DEFAULT_TENANT_ID}, keeping existing single-tenant flows
 * alive) and {@code false} in Deploy 2 (unbound → var left unset → RLS returns
 * zero rows, fail-closed).
 */
public final class TenantContext {

    /**
     * Fixed, well-known tenant every pre-multi-tenant row is migrated under
     * (seeded by Flyway V36, backfilled in V38). Must stay in sync with that
     * migration's seed UUID.
     */
    public static final UUID DEFAULT_TENANT_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000001");

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setTenantId(UUID tenantId) {
        CURRENT.set(tenantId);
    }

    /** The bound tenant, or {@code null} when nothing was set for this thread. */
    public static UUID getTenantId() {
        return CURRENT.get();
    }

    public static boolean isSet() {
        return CURRENT.get() != null;
    }

    /** Must be called in a {@code finally} once the request/transaction ends so a
     *  pooled request thread never carries a stale tenant into the next request. */
    public static void clear() {
        CURRENT.remove();
    }
}
