package com.vehiclemanagement.config;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Wires the tenant-aware {@link TenantRoutingJpaTransactionManager} as the
 * application's primary transaction manager (Spring Boot backs off its
 * auto-configured one once a {@code PlatformTransactionManager} bean is present),
 * so {@code app.tenant_id} is set at the start of every transaction.
 *
 * <p>{@code multitenancy.default-tenant-fallback} controls the unbound-context
 * behaviour and is the switch for the two-deploy rollout:
 * <ul>
 *   <li><b>Deploy 1</b> ({@code true}, the default) — unbound transactions run
 *       under {@link TenantContext#DEFAULT_TENANT_ID} so existing single-tenant
 *       flows are unaffected while RLS is still off.</li>
 *   <li><b>Deploy 2</b> ({@code false}) — unbound transactions leave
 *       {@code app.tenant_id} unset, so the forced RLS policies fail closed
 *       (zero rows) instead of falling back to the default tenant.</li>
 * </ul>
 */
@Configuration
public class TenantContextConfig {

    @Bean
    public PlatformTransactionManager transactionManager(
            EntityManagerFactory entityManagerFactory,
            @Value("${multitenancy.default-tenant-fallback:true}") boolean defaultTenantFallback,
            @Value("${multitenancy.request-db-role:app_rls}") String requestRole,
            @Value("${multitenancy.auth-db-role:app_auth}") String authRole) {
        return new TenantRoutingJpaTransactionManager(
                entityManagerFactory, defaultTenantFallback, requestRole, authRole);
    }
}
