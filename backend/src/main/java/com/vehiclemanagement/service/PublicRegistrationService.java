package com.vehiclemanagement.service;

import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.dto.PublicRegistrationRequest;
import com.vehiclemanagement.dto.PublicRegistrationResponse;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.util.JwtUtil;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class PublicRegistrationService {

    private static final String DEFAULT_SITE_NAME = "Khu vực chính";
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_SLUG_CHARACTERS = Pattern.compile("[^a-z0-9]+");
    private static final Pattern EDGE_HYPHENS = Pattern.compile("(^-|-$)");
    private static final int MAX_SLUG_LENGTH = 100;

    private static final Map<Character, Character> VIETNAMESE_D_REPLACEMENTS = Map.of(
            'đ', 'd',
            'Đ', 'D');

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public PublicRegistrationService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PlatformAdminOperation
    @Transactional
    public PublicRegistrationResponse register(PublicRegistrationRequest request) {
        String tenantName = request.getOrganizationName().trim();
        String managementModel = request.getManagementModel().trim().toLowerCase(Locale.ROOT);
        String tenantSlug = normalizeSlug(tenantName);
        String username = request.getUsername().trim().toLowerCase(Locale.ROOT);
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);

        assertUniqueTenant(tenantName, tenantSlug);
        assertUniqueUser(username, email);

        try {
            UUID tenantId = jdbc.queryForObject("""
                    INSERT INTO tenant(name, slug, management_model, area_count, status)
                    VALUES (?, ?, ?, ?, 'active')
                    RETURNING id
                    """, UUID.class, tenantName, tenantSlug, managementModel, request.getAreaCount());

            UUID siteId = jdbc.queryForObject("""
                    INSERT INTO site(tenant_id, name, location)
                    VALUES (?, ?, NULL)
                    RETURNING id
                    """, UUID.class, tenantId, DEFAULT_SITE_NAME);

            UUID userId = jdbc.queryForObject("""
                    INSERT INTO users(username, email, password, role, status, tenant_id, created_at, updated_at)
                    VALUES (?, ?, ?, 'TENANT_ADMIN', 'ACTIVE', ?, now(), now())
                    RETURNING id
                    """, UUID.class,
                    username,
                    email,
                    passwordEncoder.encode(request.getPassword()),
                    tenantId);

            String token = issueTenantAdminToken(userId, username, email, tenantId, siteId);

            return PublicRegistrationResponse.builder()
                    .tenantId(tenantId)
                    .tenantName(tenantName)
                    .managementModel(managementModel)
                    .areaCount(request.getAreaCount())
                    .siteId(siteId)
                    .siteName(DEFAULT_SITE_NAME)
                    .userId(userId)
                    .username(username)
                    .email(email)
                    .role(User.Role.TENANT_ADMIN.name())
                    .token(token)
                    .expiresAt(LocalDateTime.ofInstant(
                            jwtUtil.getExpirationDate().toInstant(),
                            ZoneId.systemDefault()))
                    .build();
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Registration conflicts with an existing organization, username, or email", ex);
        }
    }

    private void assertUniqueTenant(String tenantName, String tenantSlug) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM tenant
                WHERE lower(name) = lower(?) OR slug = ?
                """, Integer.class, tenantName, tenantSlug);
        if (count != null && count > 0) {
            throw new ConflictException("Tenant name or slug already exists");
        }
    }

    private void assertUniqueUser(String username, String email) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM users
                WHERE lower(username) = lower(?) OR lower(email) = lower(?)
                """, Integer.class, username, email);
        if (count != null && count > 0) {
            throw new ConflictException("Username or email already exists");
        }
    }

    private String issueTenantAdminToken(UUID userId, String username, String email, UUID tenantId, UUID siteId) {
        User tokenUser = User.builder()
                .id(userId)
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
        claims.put("userId", userId.toString());
        claims.put("tenant_id", tenantId.toString());
        claims.put("site_ids", List.of(siteId.toString()));
        return jwtUtil.generateToken(tokenUser, claims);
    }

    private String normalizeSlug(String tenantName) {
        String normalized = Normalizer.normalize(tenantName, Normalizer.Form.NFD);
        for (Map.Entry<Character, Character> replacement : VIETNAMESE_D_REPLACEMENTS.entrySet()) {
            normalized = normalized.replace(replacement.getKey(), replacement.getValue());
        }

        String slug = EDGE_HYPHENS.matcher(
                        NON_SLUG_CHARACTERS.matcher(
                                        COMBINING_MARKS.matcher(normalized).replaceAll(""))
                                .replaceAll("-")
                                .toLowerCase(Locale.ROOT))
                .replaceAll("");
        if (!slug.isBlank()) {
            return boundSlug(slug);
        }

        String unicodeSlug = tenantName.codePoints()
                .filter(Character::isLetterOrDigit)
                .mapToObj(codePoint -> Integer.toString(codePoint, 36))
                .collect(Collectors.joining("-"));
        if (unicodeSlug.isBlank()) {
            throw new IllegalArgumentException("Organization name must contain at least one letter or number");
        }
        return boundSlug("org-" + unicodeSlug);
    }

    private String boundSlug(String slug) {
        if (slug.length() <= MAX_SLUG_LENGTH) {
            return slug;
        }
        String suffix = "-" + shortHash(slug);
        return slug.substring(0, MAX_SLUG_LENGTH - suffix.length()) + suffix;
    }

    private String shortHash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(12);
            for (int i = 0; i < 6; i++) {
                hex.append(String.format("%02x", digest[i]));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
