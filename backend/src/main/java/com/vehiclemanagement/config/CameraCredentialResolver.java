package com.vehiclemanagement.config;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Resolves a camera credential before the request has a tenant context.
 *
 * <p>The lookup is deliberately routed through the physically separate admin
 * datasource. Normal request-datasource queries would be fail-closed by RLS
 * because the camera key is what establishes the tenant in the first place.
 * Only the candidate camera row is selected; the raw key is verified in memory
 * with the same BCrypt encoder used at issuance.</p>
 */
@Component
public class CameraCredentialResolver {

    private static final String LOOKUP_SQL = """
            SELECT id, tenant_id, site_id, status, api_key_hash,
                   previous_api_key_hash, previous_api_key_expires_at
              FROM camera
             WHERE id = ?
            """;

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public CameraCredentialResolver(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Authenticates one camera key and returns only the scope needed by the edge
     * filter. Unknown, disabled, uncredentialed, and expired credentials all look
     * identical to callers.
     */
    @PlatformAdminOperation
    public Optional<AuthenticatedCamera> authenticate(UUID cameraId, String rawKey) {
        if (cameraId == null || rawKey == null || rawKey.isBlank()) {
            return Optional.empty();
        }

        return jdbc.query(LOOKUP_SQL, rs -> {
            if (!rs.next()) {
                return Optional.empty();
            }

            UUID id = rs.getObject("id", UUID.class);
            UUID tenantId = rs.getObject("tenant_id", UUID.class);
            UUID siteId = rs.getObject("site_id", UUID.class);
            String status = rs.getString("status");
            String activeHash = rs.getString("api_key_hash");
            String previousHash = rs.getString("previous_api_key_hash");
            Timestamp previousExpires = rs.getTimestamp("previous_api_key_expires_at");

            if (tenantId == null || siteId == null || "disabled".equalsIgnoreCase(status)) {
                return Optional.empty();
            }

            if (activeHash != null && passwordEncoder.matches(rawKey, activeHash)) {
                return Optional.of(new AuthenticatedCamera(id, tenantId, siteId));
            }

            LocalDateTime expiresAt = previousExpires == null
                    ? null
                    : previousExpires.toLocalDateTime();
            if (previousHash != null
                    && expiresAt != null
                    && expiresAt.isAfter(LocalDateTime.now())
                    && passwordEncoder.matches(rawKey, previousHash)) {
                return Optional.of(new AuthenticatedCamera(id, tenantId, siteId));
            }

            return Optional.empty();
        }, cameraId);
    }

    public record AuthenticatedCamera(UUID cameraId, UUID tenantId, UUID siteId) {
    }
}
