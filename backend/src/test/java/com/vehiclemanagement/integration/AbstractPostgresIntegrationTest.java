package com.vehiclemanagement.integration;

import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base for the Phase 4.5 end-to-end integration tests. Boots the full Spring
 * context on a random port against a real PostgreSQL running in a Testcontainer,
 * so Flyway migrations + Hibernate {@code ddl-auto=update} run exactly as they do
 * in production and the whole edge -> backend -> WebSocket -> replay flow is
 * exercised against a genuine database rather than mocks.
 *
 * <p>The container is shared across every subclass (one Postgres per JVM). The
 * datasource and the secrets the app requires at boot ({@code jwt.secret},
 * {@code password-reset.fingerprint-secret}, and the {@code gate.api-key}
 * enforced by {@link com.vehiclemanagement.config.GateApiKeyAuthFilter})
 * are injected via {@link DynamicPropertySource} so the tests can assert the 401
 * path with a known key.
 *
 * <p>Tagged {@code integration} — these tests need a running Docker daemon. Run
 * the whole suite with {@code mvn test}; skip just these on a Docker-less box with
 * {@code mvn test -DexcludedGroups=integration}.
 *
 * <p>Uses the singleton-container pattern: one container is started in a static
 * initializer and kept for the whole JVM (Ryuk removes it at exit). The per-class
 * {@code @Testcontainers}/{@code @Container} lifecycle would stop the container
 * after each class, which breaks when Spring reuses a cached context across
 * integration classes (the reused context would point at a stopped container).
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "app.admin-datasource.username=test",
        "app.admin-datasource.password=test"
})
public abstract class AbstractPostgresIntegrationTest {

    /** The shared X-Gate-Key the edge must present on the protected gate endpoints. */
    protected static final String GATE_API_KEY = "integration-test-gate-key";

    @SuppressWarnings("resource") // Shared for the JVM; Ryuk removes it at exit.
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:15-alpine"))
                    .withDatabaseName("vehicle_management_test")
                    .withUsername("test")
                    .withPassword("test");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("app.admin-datasource.url", POSTGRES::getJdbcUrl);
        // Each integration class can create a distinct Spring context while sharing
        // this one Postgres container. Keep the default pools deliberately small
        // so cached contexts do not exhaust PostgreSQL's connection limit; tests
        // that exercise pooling override these values explicitly.
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> "2");
        registry.add("spring.datasource.hikari.minimum-idle", () -> "0");
        registry.add("app.admin-datasource.hikari.maximum-pool-size", () -> "1");
        registry.add("app.admin-datasource.hikari.minimum-idle", () -> "0");
        // jwt.secret has no default in application.yml; HS256 needs >= 32 bytes.
        registry.add("jwt.secret", () -> "integration-test-jwt-secret-please-change-0123456789");
        // PasswordResetService validates fingerprint secret at construction (32+ chars).
        registry.add("password-reset.fingerprint-secret",
                () -> "integration-password-reset-fingerprint-secret-0123456789");
        // Force the gate filter into enforcing mode so the missing/invalid-key 401
        // path is actually exercised (empty key would run "open").
        registry.add("gate.api-key", () -> GATE_API_KEY);
    }
}
