package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.TestPropertySource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the Deploy 2 fail-closed contract (N3): with the default-tenant fallback
 * OFF, a transaction that has not bound a tenant leaves app.tenant_id unset, so
 * the forced RLS policy returns ZERO rows rather than leaking every tenant's data.
 *
 * <p>The demo seeder is disabled here — under fail-closed it could not write the
 * DEFAULT-tenant demo users at startup anyway (that is exactly the point). Data is
 * seeded with a superuser JdbcTemplate that bypasses RLS.
 */
@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false"
})
class RlsFailClosedIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID DEFAULT_TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void unboundContextReturnsZeroRows() {
        // A real DEFAULT-tenant user exists in the table (seeded bypassing RLS)...
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                + "VALUES (?, 'failclosed-user', 'failclosed@example.com', 'x', 'USER', 'ACTIVE', ?, now(), now())",
                UUID.randomUUID(), DEFAULT_TENANT);

        // ...but with no tenant bound and the fallback off, the app path sees none.
        assertThat(TenantContext.getTenantId()).isNull();
        assertThat(userRepository.findAll()).isEmpty();
    }

    @Test
    void boundContextSeesItsOwnRows() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                + "VALUES (?, 'failclosed-bound', 'failclosed-bound@example.com', 'x', 'USER', 'ACTIVE', ?, now(), now())",
                id, DEFAULT_TENANT);

        TenantContext.setTenantId(DEFAULT_TENANT);
        try {
            assertThat(userRepository.findById(id)).isPresent();
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void loadUserByUsernameUsesAuthRoleWithoutTenantContext() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                + "VALUES (?, 'authlookup-user', 'authlookup@example.com', 'x', 'USER', 'ACTIVE', ?, now(), now())",
                id, DEFAULT_TENANT);

        assertThat(TenantContext.getTenantId()).isNull();

        UserDetails user = userService.loadUserByUsername("authlookup@example.com");

        assertThat(user.getUsername()).isEqualTo("authlookup-user");
    }
}
