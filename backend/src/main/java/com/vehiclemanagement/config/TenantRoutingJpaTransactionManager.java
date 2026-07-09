package com.vehiclemanagement.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.Session;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.UUID;

/**
 * Sets the PostgreSQL session variable {@code app.tenant_id} for the tenant
 * bound to {@link TenantContext} at the start of every transaction, so the
 * Deploy 2 Row-Level Security policies see the right tenant on the exact
 * connection the transaction will use.
 *
 * <p><b>Why override {@code doBegin} and not use a {@code TransactionSynchronization}:</b>
 * a {@code TransactionSynchronization} has no {@code afterBegin} callback — its
 * earliest hook fires around commit/completion, far too late to scope queries.
 * Overriding {@link JpaTransactionManager#doBegin} runs immediately after the
 * {@code EntityManager} and its connection are bound, before the first query.
 *
 * <p><b>Why {@code set_config(…, true)} and not {@code SET LOCAL}:</b> the third
 * argument {@code true} makes the setting transaction-local, so PostgreSQL
 * auto-resets it on COMMIT/ROLLBACK when the HikariCP connection returns to the
 * pool — no tenant A context can leak into tenant B's next request (see the N6
 * concurrency test). {@code set_config} also takes a bind parameter, so the
 * tenant id is never string-interpolated (no injection surface); bare
 * {@code SET LOCAL} cannot be parameterized.
 *
 * <p><b>Fail-closed:</b> when no tenant is bound and the default-tenant fallback
 * is off (Deploy 2), the variable is left unset; the RLS predicate
 * {@code tenant_id = current_setting('app.tenant_id', true)::uuid} then matches
 * nothing and returns zero rows rather than leaking. In Deploy 1 the fallback is
 * on, so unbound transactions run under {@link TenantContext#DEFAULT_TENANT_ID}.
 */
public class TenantRoutingJpaTransactionManager extends JpaTransactionManager {

    private static final String SET_TENANT_SQL = "select set_config('app.tenant_id', ?, true)";
    // Role names come from trusted config; still validated to a strict identifier
    // shape because SET ROLE cannot be parameterized (must be inlined).
    private static final java.util.regex.Pattern ROLE_NAME =
            java.util.regex.Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*$");

    private final boolean defaultTenantFallback;
    private final String requestRole;
    private final String authRole;

    public TenantRoutingJpaTransactionManager(EntityManagerFactory emf,
                                              boolean defaultTenantFallback,
                                              String requestRole,
                                              String authRole) {
        super(emf);
        this.defaultTenantFallback = defaultTenantFallback;
        if (requestRole != null && !requestRole.isBlank() && !ROLE_NAME.matcher(requestRole).matches()) {
            throw new IllegalArgumentException("Invalid multitenancy.request-db-role: " + requestRole);
        }
        if (authRole != null && !authRole.isBlank() && !ROLE_NAME.matcher(authRole).matches()) {
            throw new IllegalArgumentException("Invalid multitenancy.auth-db-role: " + authRole);
        }
        this.requestRole = (requestRole == null || requestRole.isBlank()) ? null : requestRole;
        this.authRole = (authRole == null || authRole.isBlank()) ? null : authRole;
    }

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {
        super.doBegin(transaction, definition);
        applyTenantSession();
    }

    private void applyTenantSession() {
        if (AdminDataSourceContext.isAdminOperation()) {
            return;
        }
        boolean authLookup = AuthDataSourceContext.isAuthLookup();

        UUID tenantId = TenantContext.getTenantId();
        if (!authLookup && tenantId == null && defaultTenantFallback) {
            tenantId = TenantContext.DEFAULT_TENANT_ID;
        }

        EntityManagerFactory emf = getEntityManagerFactory();
        if (emf == null) {
            return;
        }
        EntityManagerHolder holder =
                (EntityManagerHolder) TransactionSynchronizationManager.getResource(emf);
        if (holder == null) {
            return;
        }
        final UUID tenant = tenantId; // may be null (Deploy 2 fail-closed: app.tenant_id left unset)
        holder.getEntityManager().unwrap(Session.class).doWork(conn -> {
            // Drop from the login role to the RLS role for the rest of this
            // transaction. SET LOCAL auto-resets on commit/rollback, so a pooled
            // connection never keeps the role (or the tenant var) across requests.
            String role = authLookup ? authRole : requestRole;
            if (role != null) {
                try (var st = conn.createStatement()) {
                    st.execute("SET LOCAL ROLE " + role);
                }
            }
            if (tenant != null) {
                try (var ps = conn.prepareStatement(SET_TENANT_SQL)) {
                    ps.setString(1, tenant.toString());
                    ps.execute();
                }
            }
        });
    }
}
