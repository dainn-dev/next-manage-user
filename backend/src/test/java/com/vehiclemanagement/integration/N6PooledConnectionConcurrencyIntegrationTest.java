package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N6 — the make-or-break pooled-connection concurrency test.
 *
 * <p>The leak vector RLS multi-tenancy lives or dies on: a HikariCP connection is
 * used by tenant A, returns to the pool, and is handed to tenant B still carrying
 * A's {@code app.tenant_id} / {@code app_rls} role. If the tenant scoping were set
 * session-level ({@code SET app.tenant_id} / {@code SET ROLE}) it would survive the
 * return-to-pool and B would read A's rows. This design uses transaction-local
 * {@code SET LOCAL ROLE app_rls} + {@code set_config('app.tenant_id', …, true)}
 * in {@link com.vehiclemanagement.config.TenantRoutingJpaTransactionManager}, both
 * of which PostgreSQL auto-resets on COMMIT/ROLLBACK.
 *
 * <p>To actually exercise reuse, the pool is capped small (4) while more worker
 * threads (8) issue interleaved reads for many rounds, so the same physical
 * connection is repeatedly shared across tenants. Every read runs through the app's
 * real repository + transaction path. Three arms are interleaved: bound-A, bound-B,
 * and an <b>unbound</b> arm run under Deploy 2 (fallback off). The invariants:
 * <ul>
 *   <li>a bound response contains only the caller's tenant rows — never the other
 *       tenant's, and never zero (which would be a false green);</li>
 *   <li>an unbound response is <b>empty</b> — fail-closed. This is the sentinel for
 *       the transaction-local property: if the role/var were session-level, an
 *       unbound tx landing on a connection just used by tenant A would still carry
 *       A's context and read A's rows. Zero rows proves the pooled connection
 *       carries no residue from the previous tenant.</li>
 * </ul>
 */
@TestPropertySource(properties = {
        // Deploy 2 semantics: unbound tx -> app.tenant_id left unset -> RLS fails
        // closed. This is what makes the unbound arm a residue sentinel.
        "multitenancy.default-tenant-fallback=false",
        // Deterministic row counts: don't let the demo seeder add DEFAULT-tenant users.
        "app.seed-demo-users=false",
        // Cap the pool below the worker count so connections are forced to churn
        // between tenants — the whole point of this test.
        "spring.datasource.hikari.maximum-pool-size=4",
        "spring.datasource.hikari.minimum-idle=1"
})
class N6PooledConnectionConcurrencyIntegrationTest extends AbstractPostgresIntegrationTest {

    // Dedicated tenants so no other integration class perturbs the counts.
    private static final UUID TENANT_A = UUID.fromString("00000000-0000-0000-0000-0000000a6a6a");
    private static final UUID TENANT_B = UUID.fromString("00000000-0000-0000-0000-0000000b6b6b");
    private static final int SEED_PER_TENANT = 6;
    private static final int THREADS = 8;
    private static final int ROUNDS = 40; // THREADS * ROUNDS = 320 interleaved reads

    @TestConfiguration
    static class ReaderConfig {
        @Bean
        TenantUserReader tenantUserReader(UserRepository repo) {
            return new TenantUserReader(repo);
        }
    }

    /** Reads users through the normal repository path inside one tenant-scoped tx. */
    static class TenantUserReader {
        private final UserRepository repo;

        TenantUserReader(UserRepository repo) {
            this.repo = repo;
        }

        @Transactional(readOnly = true)
        public List<UUID> visibleUserTenantIds() {
            return repo.findAll().stream().map(User::getTenantId).collect(Collectors.toList());
        }
    }

    @Autowired
    private TenantUserReader reader;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void pooledConnectionsNeverLeakTenantContextAcrossTenants() throws InterruptedException {
        seedTenant(TENANT_A, "n6-tenant-a");
        seedTenant(TENANT_B, "n6-tenant-b");
        for (int i = 0; i < SEED_PER_TENANT; i++) {
            seedUser(TENANT_A, "n6-a-" + i);
            seedUser(TENANT_B, "n6-b-" + i);
        }

        Queue<String> violations = new ConcurrentLinkedQueue<>();
        AtomicInteger reads = new AtomicInteger();
        ExecutorService exec = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(THREADS);

        for (int t = 0; t < THREADS; t++) {
            final int threadIdx = t;
            exec.submit(() -> {
                try {
                    start.await();
                    for (int r = 0; r < ROUNDS; r++) {
                        // Interleave three arms by (thread + round) so bound-A,
                        // bound-B and unbound reads all share the same pooled
                        // connections in an unpredictable order.
                        int arm = (threadIdx + r) % 3;
                        UUID expected = (arm == 0) ? TENANT_A : (arm == 1) ? TENANT_B : null;
                        if (expected != null) {
                            TenantContext.setTenantId(expected);
                        } else {
                            TenantContext.clear(); // unbound arm
                        }
                        try {
                            List<UUID> seen = reader.visibleUserTenantIds();
                            reads.incrementAndGet();
                            if (expected == null) {
                                // Deploy 2 fail-closed: an unbound tx must see nothing,
                                // proving the reused connection kept no prior residue.
                                if (!seen.isEmpty()) {
                                    violations.add("RESIDUE LEAK: unbound tx saw " + seen.size()
                                            + " rows " + seen + " (should be fail-closed empty)");
                                }
                            } else {
                                if (seen.isEmpty()) {
                                    violations.add("bound=" + expected + " saw ZERO rows (unexpected fail-closed)");
                                }
                                for (UUID actual : seen) {
                                    if (!expected.equals(actual)) {
                                        violations.add("CROSS-TENANT LEAK: bound=" + expected + " read row of " + actual);
                                    }
                                }
                                if (seen.size() != SEED_PER_TENANT) {
                                    violations.add("bound=" + expected + " saw " + seen.size()
                                            + " rows, expected " + SEED_PER_TENANT);
                                }
                            }
                        } catch (RuntimeException e) {
                            violations.add("arm=" + arm + " expected=" + expected + " threw " + e);
                        } finally {
                            TenantContext.clear();
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }

        start.countDown(); // fire all threads at once
        boolean finished = done.await(120, TimeUnit.SECONDS);
        exec.shutdownNow();

        assertThat(finished).as("all worker threads finished within timeout").isTrue();
        assertThat(reads.get()).isEqualTo(THREADS * ROUNDS);
        assertThat(violations)
                .as("no response leaked another tenant's rows across %d pooled reads", reads.get())
                .isEmpty();
    }

    private void seedTenant(UUID id, String slug) {
        jdbc.update("INSERT INTO tenant(id, name, slug, status) VALUES (?, ?, ?, 'active') "
                + "ON CONFLICT (id) DO NOTHING", id, slug, slug);
    }

    private void seedUser(UUID tenantId, String tag) {
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                        + "VALUES (?, ?, ?, 'x', 'USER', 'ACTIVE', ?, now(), now()) ON CONFLICT (id) DO NOTHING",
                UUID.randomUUID(), tag, tag + "@example.com", tenantId);
    }
}
