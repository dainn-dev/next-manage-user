package com.vehiclemanagement.integration;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.service.PasswordResetEmailSender;
import com.vehiclemanagement.util.JwtUtil;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.sql.DriverManager;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doAnswer;

@TestPropertySource(properties = {
        "multitenancy.default-tenant-fallback=false",
        "app.seed-demo-users=false",
        "password-reset.fingerprint-secret=integration-password-reset-fingerprint-secret-0123456789",
        "password-reset.reset-url=https://frontend.example/reset-password",
        "password-reset.email-limit=2",
        "password-reset.ip-limit=4"
})
@Import(PasswordResetIntegrationTest.AdminJdbcConfig.class)
class PasswordResetIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ADMIN_LOGIN = "app_admin_login";
    private static final String ADMIN_LOGIN_PW = "app_admin_login_pw";

    @DynamicPropertySource
    static void registerAdminDataSource(DynamicPropertyRegistry registry) {
        registry.add("app.admin-datasource.url", POSTGRES::getJdbcUrl);
        registry.add("app.admin-datasource.username", () -> ADMIN_LOGIN);
        registry.add("app.admin-datasource.password", () -> ADMIN_LOGIN_PW);
    }

    @BeforeAll
    static void setAdminLoginPassword() throws Exception {
        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("DO $$ BEGIN "
                    + "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '" + ADMIN_LOGIN + "') THEN "
                    + "CREATE ROLE " + ADMIN_LOGIN + " LOGIN PASSWORD '" + ADMIN_LOGIN_PW
                    + "' NOSUPERUSER BYPASSRLS; "
                    + "ELSE ALTER ROLE " + ADMIN_LOGIN + " WITH LOGIN PASSWORD '" + ADMIN_LOGIN_PW
                    + "' NOSUPERUSER BYPASSRLS; END IF; END $$;");
        }
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    AdminJdbcGateway adminJdbcGateway;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    JwtUtil jwtUtil;

    @MockBean
    PasswordResetEmailSender passwordResetEmailSender;

    @BeforeEach
    void resetSenderBeforeEach() {
        reset(passwordResetEmailSender);
        adminJdbcGateway.clearRateLimits();
    }

    @Test
    void requestIsGenericForKnownUnknownAndRateLimitedEmails() {
        String email = "reset-known-" + unique() + "@example.com";
        seedUser(email, "OldPassword123!");

        ResponseEntity<Map> known = request(email);
        ResponseEntity<Map> limited = request(email);
        ResponseEntity<Map> rateLimited = request(email);

        assertThat(known.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(rateLimited.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(known.getBody()).isEqualTo(rateLimited.getBody());
        verify(passwordResetEmailSender, org.mockito.Mockito.times(2))
                .sendPasswordReset(anyString(), anyString());

        adminJdbcGateway.clearRateLimits();
        reset(passwordResetEmailSender);
        ResponseEntity<Map> unknown = request("unknown-" + unique() + "@example.com");
        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(known.getBody()).isEqualTo(unknown.getBody());
        verify(passwordResetEmailSender, org.mockito.Mockito.never())
                .sendPasswordReset(anyString(), anyString());
    }

    @Test
    void confirmChangesPasswordInvalidatesPriorJwtAndAllowsSingleUseOnly() {
        String email = "reset-confirm-" + unique() + "@example.com";
        UUID userId = seedUser(email, "OldPassword123!");
        AtomicReference<String> resetUrl = captureResetUrl();

        ResponseEntity<Map> requested = request(email);
        assertThat(requested.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        String rawToken = resetUrl.get().substring(resetUrl.get().indexOf("token=") + "token=".length());

        User userBeforeReset = adminJdbcGateway.loadUser(userId);
        String oldJwt = jwtUtil.generateToken(userBeforeReset);
        assertThat(jwtUtil.validateToken(oldJwt, userBeforeReset)).isTrue();

        ResponseEntity<Map> confirmed = rest.postForEntity(url("/api/auth/password-reset/confirm"),
                new HttpEntity<>(Map.of("token", rawToken, "newPassword", "NewPassword123!"), jsonHeaders()), Map.class);
        assertThat(confirmed.getStatusCode()).isEqualTo(HttpStatus.OK);

        User userAfterReset = adminJdbcGateway.loadUser(userId);
        assertThat(userAfterReset.getPasswordVersion()).isEqualTo(userBeforeReset.getPasswordVersion() + 1);
        assertThat(userAfterReset.getPasswordChangedAt()).isNotNull();
        assertThat(passwordEncoder.matches("NewPassword123!", userAfterReset.getPassword())).isTrue();
        assertThat(jwtUtil.validateToken(oldJwt, userAfterReset)).isFalse();

        ResponseEntity<Map> replay = rest.postForEntity(url("/api/auth/password-reset/confirm"),
                new HttpEntity<>(Map.of("token", rawToken, "newPassword", "AnotherPassword123!"), jsonHeaders()), Map.class);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void newerRequestInvalidatesSiblingTokenAndFailedDeliveryRevokesToken() {
        String email = "reset-sibling-" + unique() + "@example.com";
        seedUser(email, "OldPassword123!");
        AtomicReference<String> firstUrl = captureResetUrl();
        request(email);
        String firstToken = tokenFrom(firstUrl.get());

        AtomicReference<String> secondUrl = captureResetUrl();
        request(email);
        String secondToken = tokenFrom(secondUrl.get());

        ResponseEntity<Map> siblingReplay = confirm(firstToken, "NewPassword123!");
        assertThat(siblingReplay.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(confirm(secondToken, "NewPassword123!").getStatusCode()).isEqualTo(HttpStatus.OK);

        String failedEmail = "reset-failure-" + unique() + "@example.com";
        seedUser(failedEmail, "OldPassword123!");
        reset(passwordResetEmailSender);
        doThrow(new IllegalStateException("provider unavailable"))
                .when(passwordResetEmailSender).sendPasswordReset(anyString(), anyString());
        ResponseEntity<Map> failureRequest = request(failedEmail);
        assertThat(failureRequest.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(adminJdbcGateway.activeTokenCount(failedEmail, OffsetDateTime.now())).isZero();
    }

    private AtomicReference<String> captureResetUrl() {
        reset(passwordResetEmailSender);
        AtomicReference<String> url = new AtomicReference<>();
        doAnswer(invocation -> {
            url.set(invocation.getArgument(1));
            return null;
        }).when(passwordResetEmailSender).sendPasswordReset(anyString(), anyString());
        return url;
    }

    private ResponseEntity<Map> request(String email) {
        return rest.postForEntity(url("/api/auth/password-reset/request"),
                new HttpEntity<>(Map.of("email", email), jsonHeaders()), Map.class);
    }

    private ResponseEntity<Map> confirm(String token, String password) {
        return rest.postForEntity(url("/api/auth/password-reset/confirm"),
                new HttpEntity<>(Map.of("token", token, "newPassword", password), jsonHeaders()), Map.class);
    }

    private UUID seedUser(String email, String password) {
        return adminJdbcGateway.seedUser(email, passwordEncoder.encode(password));
    }

    private String tokenFrom(String resetUrl) {
        return resetUrl.substring(resetUrl.indexOf("token=") + "token=".length());
    }

    private String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    @TestConfiguration
    static class AdminJdbcConfig {
        @Bean
        AdminJdbcGateway adminJdbcGateway(JdbcTemplate jdbc) {
            return new AdminJdbcGateway(jdbc);
        }
    }

    static class AdminJdbcGateway {
        private final JdbcTemplate jdbc;

        AdminJdbcGateway(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @PlatformAdminOperation
        @org.springframework.transaction.annotation.Transactional
        UUID seedUser(String email, String password) {
            return jdbc.queryForObject("""
                    INSERT INTO users(username, email, password, role, status, tenant_id, created_at, updated_at)
                    VALUES (?, ?, ?, 'MEMBER', 'ACTIVE',
                            '00000000-0000-0000-0000-000000000001', now(), now())
                    RETURNING id
                    """, UUID.class, "reset-" + UUID.randomUUID(), email, password);
        }

        @PlatformAdminOperation
        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        User loadUser(UUID userId) {
            return jdbc.queryForObject("""
                    SELECT id, username, email, password, role, status, tenant_id,
                           password_changed_at, password_version, created_at, updated_at
                    FROM users WHERE id = ?
                    """, (rs, rowNum) -> User.builder()
                    .id(rs.getObject("id", UUID.class))
                    .username(rs.getString("username"))
                    .email(rs.getString("email"))
                    .password(rs.getString("password"))
                    .role(User.Role.valueOf(rs.getString("role")))
                    .status(User.UserStatus.valueOf(rs.getString("status")))
                    .tenantId(rs.getObject("tenant_id", UUID.class))
                    .passwordChangedAt(toLocalDateTime(rs.getObject("password_changed_at", OffsetDateTime.class)))
                    .passwordVersion(rs.getInt("password_version"))
                    .createdAt(toLocalDateTime(rs.getObject("created_at", OffsetDateTime.class)))
                    .updatedAt(toLocalDateTime(rs.getObject("updated_at", OffsetDateTime.class)))
                    .build(), userId);
        }

        private java.time.LocalDateTime toLocalDateTime(OffsetDateTime value) {
            return value == null ? null : value.toLocalDateTime();
        }

        @PlatformAdminOperation
        @org.springframework.transaction.annotation.Transactional
        void clearRateLimits() {
            jdbc.update("DELETE FROM password_reset_rate_limits");
        }

        @PlatformAdminOperation
        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        long activeTokenCount(String email, OffsetDateTime now) {
            Long count = jdbc.queryForObject("""
                    SELECT count(*)
                    FROM password_reset_tokens token
                    JOIN users ON users.id = token.user_id
                    WHERE lower(users.email) = lower(?)
                      AND token.used_at IS NULL
                      AND token.revoked_at IS NULL
                      AND token.expires_at > ?
                    """, Long.class, email, now);
            return count == null ? 0 : count;
        }
    }
}
