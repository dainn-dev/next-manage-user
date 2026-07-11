package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Narrow cross-tenant persistence boundary for unauthenticated password recovery.
 * Every operation is routed through the physically separate admin datasource;
 * app_auth remains a read-only identity-lookup role.
 */
@Component
public class PasswordResetStore {

    private final JdbcTemplate jdbc;

    public PasswordResetStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PlatformAdminOperation
    @Transactional
    public Optional<PendingDelivery> createRequest(
            String normalizedEmail,
            String emailFingerprint,
            String ipFingerprint,
            String tokenHash,
            OffsetDateTime now,
            OffsetDateTime expiresAt,
            OffsetDateTime rateWindowCutoff,
            int emailLimit,
            int ipLimit) {
        List<UserTarget> users = jdbc.query("""
                SELECT id, email
                FROM users
                WHERE lower(email) = ?
                  AND status = 'ACTIVE'
                ORDER BY id
                LIMIT 2
                """, (rs, rowNum) -> new UserTarget(
                rs.getObject("id", UUID.class), rs.getString("email")), normalizedEmail);

        boolean emailAllowed = consumeRateLimit(
                "email", emailFingerprint, now, rateWindowCutoff, emailLimit);
        boolean ipAllowed = consumeRateLimit(
                "ip", ipFingerprint, now, rateWindowCutoff, ipLimit);

        if (!emailAllowed || !ipAllowed || users.size() != 1) {
            return Optional.empty();
        }

        UserTarget user = users.getFirst();
        jdbc.update("""
                UPDATE password_reset_tokens
                SET revoked_at = ?
                WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL
                """, now, user.id());

        UUID tokenId = jdbc.queryForObject("""
                INSERT INTO password_reset_tokens(
                    user_id, email_fingerprint, request_ip_fingerprint,
                    token_hash, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, user.id(), emailFingerprint, ipFingerprint,
                tokenHash, now, expiresAt);
        return Optional.of(new PendingDelivery(tokenId, user.email()));
    }

    @PlatformAdminOperation
    @Transactional
    public void revoke(UUID tokenId, OffsetDateTime revokedAt) {
        jdbc.update("""
                UPDATE password_reset_tokens
                SET revoked_at = ?
                WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
                """, revokedAt, tokenId);
    }

    @PlatformAdminOperation
    @Transactional
    public boolean consume(String tokenHash, String encodedPassword, OffsetDateTime now) {
        List<TokenTarget> targets = jdbc.query("""
                SELECT token.id, token.user_id
                FROM password_reset_tokens token
                JOIN users ON users.id = token.user_id
                WHERE token.token_hash = ?
                  AND token.expires_at > ?
                  AND token.used_at IS NULL
                  AND token.revoked_at IS NULL
                FOR UPDATE OF token, users
                """, (rs, rowNum) -> new TokenTarget(
                rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class)),
                tokenHash, now);
        if (targets.isEmpty()) {
            return false;
        }

        TokenTarget target = targets.getFirst();
        int updated = jdbc.update("""
                UPDATE users
                SET password = ?, password_changed_at = ?,
                    password_version = password_version + 1,
                    updated_at = ?
                WHERE id = ?
                """, encodedPassword, now, now, target.userId());
        if (updated != 1) {
            throw new IllegalStateException("Password reset target no longer exists");
        }

        jdbc.update("""
                UPDATE password_reset_tokens
                SET revoked_at = ?
                WHERE user_id = ? AND id <> ?
                  AND used_at IS NULL AND revoked_at IS NULL
                """, now, target.userId(), target.tokenId());
        return jdbc.update("""
                UPDATE password_reset_tokens
                SET used_at = ?
                WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
                """, now, target.tokenId()) == 1;
    }

    private boolean consumeRateLimit(
            String scope,
            String fingerprint,
            OffsetDateTime now,
            OffsetDateTime cutoff,
            int limit) {
        Integer count = jdbc.queryForObject("""
                INSERT INTO password_reset_rate_limits(
                    scope, fingerprint, window_started_at, request_count)
                VALUES (?, ?, ?, 1)
                ON CONFLICT (scope, fingerprint) DO UPDATE SET
                    window_started_at = CASE
                        WHEN password_reset_rate_limits.window_started_at <= ?
                            THEN EXCLUDED.window_started_at
                        ELSE password_reset_rate_limits.window_started_at
                    END,
                    request_count = CASE
                        WHEN password_reset_rate_limits.window_started_at <= ? THEN 1
                        ELSE password_reset_rate_limits.request_count + 1
                    END
                RETURNING request_count
                """, Integer.class, scope, fingerprint, now, cutoff, cutoff);
        return count != null && count <= limit;
    }

    public record PendingDelivery(UUID tokenId, String email) {
    }

    private record UserTarget(UUID id, String email) {
    }

    private record TokenTarget(UUID tokenId, UUID userId) {
    }
}
