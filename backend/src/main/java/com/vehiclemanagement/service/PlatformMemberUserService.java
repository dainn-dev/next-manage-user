package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.entity.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Inserts platform {@link User.Role#MEMBER} rows with {@code tenant_id NULL}
 * (ADR-0603 Phase C). Must run on the admin datasource (BYPASSRLS).
 */
@Service
public class PlatformMemberUserService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public PlatformMemberUserService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @PlatformAdminOperation
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID insertPlatformMember(
            String username,
            String email,
            String rawPassword,
            String firstName,
            String lastName,
            User.UserStatus status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (
                    id, username, email, password, first_name, last_name,
                    role, status, tenant_id, password_version, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    'MEMBER', ?, NULL, 0, NOW(), NOW()
                )
                """,
                id,
                username,
                email,
                passwordEncoder.encode(rawPassword),
                firstName,
                lastName,
                status != null ? status.name() : User.UserStatus.ACTIVE.name());
        return id;
    }
}
