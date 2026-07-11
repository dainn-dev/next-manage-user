package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.TenantContext;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves DB-level tenant isolation (N1) and the G1 guardrail: under one tenant's
 * context the application (running as the app_rls role via
 * TenantRoutingJpaTransactionManager) cannot read another tenant's users through
 * the normal repository/management path — even though the rows exist.
 *
 * <p>Cross-tenant rows are seeded with a raw {@link JdbcTemplate} which uses the
 * container's superuser connection and therefore bypasses RLS; the assertions
 * then read back through the tenant-scoped app path.
 *
 * <p>Phase C (ADR-0603): ops users ({@code TENANT_ADMIN}) stay stamped with
 * {@code users.tenant_id}; platform {@code MEMBER} rows use {@code tenant_id NULL}
 * and are visible via {@code member_affiliation} RLS.
 */
class TenantIsolationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID DEFAULT_TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID TENANT_B = UUID.fromString("00000000-0000-0000-0000-0000000000b0");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void tenantCannotReadAnotherTenantsUsers() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        seedTenant(TENANT_B, "tenant-b");
        seedOpsUser(userA, "iso-default-user", "iso-default@example.com", DEFAULT_TENANT);
        seedOpsUser(userB, "iso-tenantb-user", "iso-tenantb@example.com", TENANT_B);

        // Under the DEFAULT tenant, tenant B's user is invisible.
        TenantContext.setTenantId(DEFAULT_TENANT);
        try {
            List<UUID> ids = userRepository.findAll().stream().map(User::getId).toList();
            assertThat(ids).contains(userA);
            assertThat(ids).doesNotContain(userB);
        } finally {
            TenantContext.clear();
        }

        // Under tenant B, the DEFAULT tenant's user is invisible.
        TenantContext.setTenantId(TENANT_B);
        try {
            List<UUID> ids = userRepository.findAll().stream().map(User::getId).toList();
            assertThat(ids).contains(userB);
            assertThat(ids).doesNotContain(userA);
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void writeIsStampedWithTheSessionTenantAndCannotCrossTenants() {
        seedTenant(TENANT_B, "tenant-b");

        // A TENANT_ADMIN created under tenant B is stamped tenant B by the column default,
        // and is then only visible under tenant B — not the DEFAULT tenant.
        TenantContext.setTenantId(TENANT_B);
        UUID created;
        try {
            User u = User.builder()
                    .username("iso-created-b").email("iso-created-b@example.com")
                    .password("secret123").role(User.Role.TENANT_ADMIN).status(User.UserStatus.ACTIVE)
                    .build();
            created = userRepository.save(u).getId();
        } finally {
            TenantContext.clear();
        }

        Long tenantOfCreated = jdbc.queryForObject(
                "SELECT (tenant_id = ?)::int FROM users WHERE id = ?", Long.class, TENANT_B, created);
        assertThat(tenantOfCreated).isEqualTo(1L);

        TenantContext.setTenantId(DEFAULT_TENANT);
        try {
            assertThat(userRepository.findById(created)).isEmpty();
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void affiliatedMemberIsVisibleOnlyUnderAffiliationTenant() {
        UUID memberId = UUID.randomUUID();
        seedTenant(TENANT_B, "tenant-b");
        seedPlatformMember(memberId, "iso-member", "iso-member@example.com");
        seedAffiliation(memberId, TENANT_B);

        TenantContext.setTenantId(TENANT_B);
        try {
            assertThat(userRepository.findById(memberId)).isPresent();
        } finally {
            TenantContext.clear();
        }

        TenantContext.setTenantId(DEFAULT_TENANT);
        try {
            assertThat(userRepository.findById(memberId)).isEmpty();
        } finally {
            TenantContext.clear();
        }
    }

    private void seedTenant(UUID id, String slug) {
        jdbc.update("INSERT INTO tenant(id, name, slug, status) VALUES (?, ?, ?, 'active') "
                + "ON CONFLICT (id) DO NOTHING", id, slug, slug);
    }

    private void seedOpsUser(UUID id, String username, String email, UUID tenantId) {
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                + "VALUES (?, ?, ?, 'x', 'TENANT_ADMIN', 'ACTIVE', ?, now(), now())", id, username, email, tenantId);
    }

    private void seedPlatformMember(UUID id, String username, String email) {
        jdbc.update("INSERT INTO users(id, username, email, password, role, status, tenant_id, created_at, updated_at) "
                + "VALUES (?, ?, ?, 'x', 'MEMBER', 'ACTIVE', NULL, now(), now())", id, username, email);
    }

    private void seedAffiliation(UUID userId, UUID tenantId) {
        jdbc.update("INSERT INTO member_affiliation(user_id, tenant_id, status, created_at, updated_at) "
                + "VALUES (?, ?, 'ACTIVE', now(), now()) ON CONFLICT DO NOTHING", userId, tenantId);
    }
}
