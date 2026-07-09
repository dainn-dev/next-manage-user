package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * N2 — DB-layer (not ORM) tenant isolation for <em>raw SQL</em>.
 *
 * <p>The point of this test is the escape hatch every RLS design must survive:
 * code that goes <b>around</b> the ORM. This foundation deliberately has <b>no
 * Hibernate {@code @Filter}/{@code @FilterDef}</b> — isolation is enforced 100% by
 * PostgreSQL Row-Level Security, so a native/raw query with no {@code tenant_id}
 * predicate of its own must still be confined. If isolation lived only at the ORM
 * layer (an entity filter), {@code em.createNativeQuery("SELECT ... FROM site")}
 * would leak every tenant's rows; because it lives in the database, it does not.
 *
 * <p>The raw statements run through the application's real transaction machinery
 * ({@link com.vehiclemanagement.config.TenantRoutingJpaTransactionManager}), so
 * each one executes on a connection that has {@code SET LOCAL ROLE app_rls} plus
 * the transaction-local {@code app.tenant_id} — exactly the production request
 * path, minus the ORM. Uses {@code site} (the generic {@code tenant_isolation}
 * policy, no {@code app_auth} exception) so the assertions exercise the plain
 * per-tenant policy, not the users-lookup carve-out.
 *
 * <p>Cross-tenant rows are seeded with a superuser {@link JdbcTemplate} that
 * bypasses RLS; the assertions then read back through the app (app_rls) path.
 */
class N2RawSqlDbLayerIsolationIntegrationTest extends AbstractPostgresIntegrationTest {

    // Dedicated tenants/sites so no other integration class pollutes the counts.
    private static final UUID TENANT_A = UUID.fromString("00000000-0000-0000-0000-0000000a2a2a");
    private static final UUID TENANT_B = UUID.fromString("00000000-0000-0000-0000-0000000b2b2b");
    private static final UUID SITE_A   = UUID.fromString("00000000-0000-0000-0000-00000051a2a2");
    private static final UUID SITE_B   = UUID.fromString("00000000-0000-0000-0000-00000051b2b2");

    /** Runs raw SQL inside the app's tenant-scoped transaction (SET LOCAL ROLE +
     *  set_config applied by the custom tx manager at begin), bypassing the ORM. */
    @TestConfiguration
    static class RawSqlConfig {
        @Bean
        RawSqlGateway rawSqlGateway() {
            return new RawSqlGateway();
        }
    }

    static class RawSqlGateway {
        @PersistenceContext
        private EntityManager em;

        /** Raw read with NO tenant predicate — RLS alone decides what is visible. */
        @Transactional(readOnly = true)
        public List<String> siteTenantIdsViaRawSql() {
            @SuppressWarnings("unchecked")
            // CAST(... AS text), not ::text — Hibernate reads "::" in a native query
            // as a named-parameter marker (":text") and fails to parse it.
            List<String> ids = em.createNativeQuery("SELECT CAST(tenant_id AS text) FROM site").getResultList();
            return ids;
        }

        /** Raw write stamped with another tenant's id — WITH CHECK must reject it. */
        @Transactional
        public void insertSiteStampedWith(UUID tenantId, UUID siteId, String name) {
            em.createNativeQuery(
                    "INSERT INTO site(id, tenant_id, name, location) VALUES (?1, ?2, ?3, 'raw')")
                    .setParameter(1, siteId)
                    .setParameter(2, tenantId)
                    .setParameter(3, name)
                    .executeUpdate();
        }
    }

    @Autowired
    private RawSqlGateway rawSql;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void rawSqlIsConfinedByRlsAtTheDbLayerNotTheOrm() {
        seedTenant(TENANT_A, "n2-tenant-a");
        seedTenant(TENANT_B, "n2-tenant-b");
        seedSite(SITE_A, TENANT_A, "n2-site-a");
        seedSite(SITE_B, TENANT_B, "n2-site-b");

        // Bound to tenant A: a raw "SELECT ... FROM site" (no tenant filter of its
        // own) returns ONLY tenant A's rows. Tenant B is invisible at the DB layer.
        TenantContext.setTenantId(TENANT_A);
        try {
            Set<String> visible = distinct(rawSql.siteTenantIdsViaRawSql());
            assertThat(visible).containsExactly(TENANT_A.toString());
            assertThat(visible).doesNotContain(TENANT_B.toString());
        } finally {
            TenantContext.clear();
        }

        // Bound to tenant B: the mirror — only B is visible, A is not.
        TenantContext.setTenantId(TENANT_B);
        try {
            Set<String> visible = distinct(rawSql.siteTenantIdsViaRawSql());
            assertThat(visible).containsExactly(TENANT_B.toString());
            assertThat(visible).doesNotContain(TENANT_A.toString());
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void rawSqlWriteCannotStampAnotherTenant() {
        seedTenant(TENANT_A, "n2-tenant-a");
        seedTenant(TENANT_B, "n2-tenant-b");

        // Bound to tenant A, a raw INSERT that explicitly stamps tenant B is
        // rejected by the WITH CHECK arm of the policy at the DB layer.
        UUID rogue = UUID.randomUUID();
        TenantContext.setTenantId(TENANT_A);
        try {
            assertThatThrownBy(() -> rawSql.insertSiteStampedWith(TENANT_B, rogue, "n2-rogue"))
                    .hasStackTraceContaining("row-level security policy");
        } finally {
            TenantContext.clear();
        }

        // Nothing was written (seeded/read as superuser, bypassing RLS).
        Long count = jdbc.queryForObject("SELECT count(*) FROM site WHERE id = ?", Long.class, rogue);
        assertThat(count).isZero();
    }

    private Set<String> distinct(List<String> ids) {
        return ids.stream().collect(Collectors.toSet());
    }

    private void seedTenant(UUID id, String slug) {
        jdbc.update("INSERT INTO tenant(id, name, slug, status) VALUES (?, ?, ?, 'active') "
                + "ON CONFLICT (id) DO NOTHING", id, slug, slug);
    }

    private void seedSite(UUID id, UUID tenantId, String name) {
        jdbc.update("INSERT INTO site(id, tenant_id, name, location) VALUES (?, ?, ?, 'seed') "
                + "ON CONFLICT (id) DO NOTHING", id, tenantId, name);
    }
}
