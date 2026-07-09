package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.dto.TenantOnboardingRequest;
import com.vehiclemanagement.dto.TenantOnboardingResponse;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.util.JwtUtil;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class TenantOnboardingService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public TenantOnboardingService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PlatformAdminOperation
    @Transactional
    public TenantOnboardingResponse onboardTenant(TenantOnboardingRequest request) {
        if (request.getAdminRole() != null && request.getAdminRole() != User.Role.TENANT_ADMIN) {
            throw new IllegalArgumentException("Initial tenant admin role must be TENANT_ADMIN");
        }

        String tenantName = request.getTenantName().trim();
        String tenantSlug = normalizeSlug(request.getTenantSlug(), tenantName);
        String siteName = request.getSiteName().trim();
        String adminUsername = request.getAdminUsername().trim();
        String adminEmail = request.getAdminEmail().trim().toLowerCase(Locale.ROOT);

        assertUniqueTenant(tenantName, tenantSlug);
        assertUniqueAdmin(adminUsername, adminEmail);

        UUID tenantId = jdbc.queryForObject("""
                INSERT INTO tenant(name, slug, status)
                VALUES (?, ?, 'active')
                RETURNING id
                """, UUID.class, tenantName, tenantSlug);

        UUID siteId = jdbc.queryForObject("""
                INSERT INTO site(tenant_id, name, location)
                VALUES (?, ?, ?)
                RETURNING id
                """, UUID.class, tenantId, siteName, blankToNull(request.getSiteLocation()));

        UUID adminUserId = jdbc.queryForObject("""
                INSERT INTO users(username, email, password, first_name, last_name,
                                  role, status, tenant_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'TENANT_ADMIN', 'ACTIVE', ?, now(), now())
                RETURNING id
                """, UUID.class,
                adminUsername,
                adminEmail,
                passwordEncoder.encode(request.getAdminPassword()),
                blankToNull(request.getAdminFirstName()),
                blankToNull(request.getAdminLastName()),
                tenantId);

        String token = issueTenantAdminToken(adminUserId, adminUsername, adminEmail, tenantId, siteId);

        return TenantOnboardingResponse.builder()
                .tenantId(tenantId)
                .tenantName(tenantName)
                .tenantSlug(tenantSlug)
                .siteId(siteId)
                .siteName(siteName)
                .adminUserId(adminUserId)
                .adminUsername(adminUsername)
                .adminEmail(adminEmail)
                .role(User.Role.TENANT_ADMIN.name())
                .token(token)
                .expiresAt(LocalDateTime.ofInstant(
                        jwtUtil.getExpirationDate().toInstant(),
                        ZoneId.systemDefault()))
                .build();
    }

    private void assertUniqueTenant(String tenantName, String tenantSlug) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM tenant
                WHERE lower(name) = lower(?) OR slug = ?
                """, Integer.class, tenantName, tenantSlug);
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Tenant name or slug already exists");
        }
    }

    private void assertUniqueAdmin(String username, String email) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM users
                WHERE lower(username) = lower(?) OR lower(email) = lower(?)
                """, Integer.class, username, email);
        if (count != null && count > 0) {
            throw new IllegalArgumentException("Admin username or email already exists");
        }
    }

    private String issueTenantAdminToken(UUID adminUserId, String username, String email, UUID tenantId, UUID siteId) {
        User tokenUser = User.builder()
                .id(adminUserId)
                .username(username)
                .email(email)
                .password("")
                .role(User.Role.TENANT_ADMIN)
                .status(User.UserStatus.ACTIVE)
                .tenantId(tenantId)
                .build();

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", User.Role.TENANT_ADMIN.name());
        claims.put("email", email);
        claims.put("userId", adminUserId.toString());
        claims.put("tenant_id", tenantId.toString());
        claims.put("site_ids", List.of(siteId.toString()));
        return jwtUtil.generateToken(tokenUser, claims);
    }

    private String normalizeSlug(String requestedSlug, String tenantName) {
        String source = (requestedSlug == null || requestedSlug.isBlank()) ? tenantName : requestedSlug;
        String slug = source.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (slug.isBlank()) {
            throw new IllegalArgumentException("Tenant slug must contain at least one letter or number");
        }
        return slug;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
