package com.vehiclemanagement.platform;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class PlatformAdminUserService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final PlatformAuditService auditService;

    public PlatformAdminUserService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            PlatformAuditService auditService) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public List<PlatformAdminDto> list() {
        return jdbc.query("""
                SELECT id, username, email, first_name, last_name, status, last_login, created_at, updated_at
                FROM users
                WHERE role = 'PLATFORM_ADMIN'
                ORDER BY username ASC
                """, (rs, rowNum) -> mapAdmin(rs));
    }

    @PlatformAdminOperation
    @Transactional(readOnly = true)
    public long count() {
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE role = 'PLATFORM_ADMIN'", Long.class);
        return count == null ? 0 : count;
    }

    /**
     * Dev seeder helper: insert PLATFORM_ADMIN with {@code tenant_id NULL}
     * (must run on admin datasource — BYPASSRLS).
     */
    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID insertPlatformAdmin(
            String username,
            String email,
            String rawPassword,
            String firstName,
            String lastName) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (
                    id, username, email, password, first_name, last_name,
                    role, status, tenant_id, password_version, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    'PLATFORM_ADMIN', 'ACTIVE', NULL, 0, NOW(), NOW()
                )
                """,
                id,
                username,
                email,
                passwordEncoder.encode(rawPassword),
                blankToNull(firstName),
                blankToNull(lastName));
        return id;
    }

    /** Cross-RLS existence check for the demo seeder (admin datasource). */
    @PlatformAdminOperation
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public boolean existsByUsername(String username) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE lower(username) = lower(?)",
                Integer.class,
                username);
        return n != null && n > 0;
    }

    /** Total user rows including platform-scoped accounts (admin datasource). */
    @PlatformAdminOperation
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public long countAllUsers() {
        Long count = jdbc.queryForObject("SELECT count(*) FROM users", Long.class);
        return count == null ? 0 : count;
    }

    /**
     * Promote an existing demo ops user to PLATFORM_ADMIN with {@code tenant_id NULL}.
     * Returns true when a row was updated.
     */
    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean promoteToPlatformAdmin(String username) {
        int updated = jdbc.update("""
                UPDATE users
                SET role = 'PLATFORM_ADMIN',
                    tenant_id = NULL,
                    updated_at = NOW()
                WHERE lower(username) = lower(?)
                  AND role <> 'PLATFORM_ADMIN'
                """, username);
        return updated > 0;
    }

    @PlatformAdminOperation
    @Transactional
    public PlatformAdminMutationResponse create(CreatePlatformAdminRequest request) {
        String username = request.username().trim();
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Integer dup = jdbc.queryForObject("""
                SELECT count(*) FROM users
                WHERE lower(username) = lower(?) OR lower(email) = lower(?)
                """, Integer.class, username, email);
        if (dup != null && dup > 0) {
            throw new IllegalArgumentException("Username or email already exists");
        }

        UUID id = jdbc.queryForObject("""
                INSERT INTO users(username, email, password, first_name, last_name,
                                  role, status, tenant_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'PLATFORM_ADMIN', 'ACTIVE', NULL, now(), now())
                RETURNING id
                """, UUID.class,
                username,
                email,
                passwordEncoder.encode(request.password()),
                blankToNull(request.firstName()),
                blankToNull(request.lastName()));

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("username", username);
        detail.put("email", email);
        UUID auditId = auditService.record("platform_admin_created", "platform_admin", id, detail);
        return new PlatformAdminMutationResponse(get(id), auditId, "platform_admin_created");
    }

    @PlatformAdminOperation
    @Transactional
    public PlatformAdminMutationResponse update(UUID id, UpdatePlatformAdminRequest request) {
        PlatformAdminDto existing = get(id);
        UUID selfId = currentUserId();
        if (selfId != null && selfId.equals(id) && request.status() != null
                && request.status() != User.UserStatus.ACTIVE) {
            throw new IllegalArgumentException("Cannot suspend your own platform admin account");
        }

        // Require a reason when deactivating or suspending
        if (request.status() != null && request.status() != User.UserStatus.ACTIVE) {
            if (request.reason() == null || request.reason().isBlank()) {
                throw new IllegalArgumentException("A reason is required when suspending or deactivating a platform admin account");
            }
            // Last-active-admin safeguard
            Long activeCount = jdbc.queryForObject(
                    "SELECT count(*) FROM users WHERE role = 'PLATFORM_ADMIN' AND status = 'ACTIVE' AND id <> ?",
                    Long.class, id);
            if (activeCount == null || activeCount == 0) {
                throw new IllegalStateException("Cannot deactivate the last active platform admin account");
            }
        }

        String firstName = request.firstName() != null ? blankToNull(request.firstName()) : existing.firstName();
        String lastName = request.lastName() != null ? blankToNull(request.lastName()) : existing.lastName();
        User.UserStatus status = request.status() != null ? request.status() : existing.status();

        jdbc.update("""
                UPDATE users
                SET first_name = ?, last_name = ?, status = ?, updated_at = now()
                WHERE id = ? AND role = 'PLATFORM_ADMIN'
                """, firstName, lastName, status.name(), id);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("status", status.name());
        if (request.reason() != null && !request.reason().isBlank()) {
            detail.put("reason", request.reason().trim());
        }
        if (request.firstName() != null) {
            detail.put("firstName", firstName == null ? "" : firstName);
        }
        if (request.lastName() != null) {
            detail.put("lastName", lastName == null ? "" : lastName);
        }
        UUID auditId = auditService.record("platform_admin_updated", "platform_admin", id, detail);
        return new PlatformAdminMutationResponse(get(id), auditId, "platform_admin_updated");
    }

    private PlatformAdminDto get(UUID id) {
        List<PlatformAdminDto> rows = jdbc.query("""
                SELECT id, username, email, first_name, last_name, status, last_login, created_at, updated_at
                FROM users
                WHERE id = ? AND role = 'PLATFORM_ADMIN'
                """, (rs, rowNum) -> mapAdmin(rs), id);
        if (rows.isEmpty()) {
            throw new ResourceNotFoundException("Platform admin not found: " + id);
        }
        return rows.get(0);
    }

    private PlatformAdminDto mapAdmin(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new PlatformAdminDto(
                rs.getObject("id", UUID.class),
                rs.getString("username"),
                rs.getString("email"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                User.UserStatus.valueOf(rs.getString("status")),
                rs.getTimestamp("last_login") == null ? null : rs.getTimestamp("last_login").toLocalDateTime(),
                rs.getTimestamp("created_at").toLocalDateTime(),
                rs.getTimestamp("updated_at").toLocalDateTime());
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user.getId();
        }
        return null;
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public record PlatformAdminDto(
            UUID id,
            String username,
            String email,
            String firstName,
            String lastName,
            User.UserStatus status,
            LocalDateTime lastLogin,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
    }

    public record CreatePlatformAdminRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6) String password,
            String firstName,
            String lastName) {
    }

    public record UpdatePlatformAdminRequest(
            String firstName,
            String lastName,
            User.UserStatus status,
            @Size(max = 500, message = "Reason must be at most 500 characters")
            String reason) {
    }

    public record PlatformAdminMutationResponse(
            PlatformAdminDto admin,
            UUID auditId,
            String auditAction) {
    }
}
