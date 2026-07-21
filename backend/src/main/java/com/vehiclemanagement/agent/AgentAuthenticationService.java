package com.vehiclemanagement.agent;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * Service for agent authentication: device token issuance, refresh, and validation.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentAuthenticationService {

    private static final String TOKEN_AUDIENCE = "site-agent";
    private static final int ACCESS_TOKEN_VALIDITY_HOURS = 1;
    private static final int REFRESH_TOKEN_VALIDITY_DAYS = 90;
    private static final int REFRESH_TOKEN_LENGTH = 64; // bytes, base64-encoded

    private final SiteAgentRepository agentRepository;
    private final SiteAgentCredentialRepository credentialRepository;
    private final SiteAgentEnrollmentCodeRepository enrollmentCodeRepository;
    private final AgentEnrollmentService enrollmentService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${jwt.secret}")
    private String jwtSecret;

    /**
     * Enroll a new agent using an enrollment code.
     * @return Agent entity and tokens
     */
    @Transactional
    public EnrollmentResult enrollAgent(EnrollmentRequest request) {
        // Validate enrollment code
        SiteAgentEnrollmentCode enrollmentCode =
            enrollmentService.validateAndConsumeCode(request.enrollmentCode);

        // Create agent entity
        String fingerprintHash = hashFingerprint(request.deviceFingerprint);

        SiteAgent agent = SiteAgent.builder()
            .siteId(enrollmentCode.getSiteId())
            .name(request.name)
            .deviceFingerprintHash(fingerprintHash)
            .status(SiteAgent.AgentStatus.provisioning)
            .version(request.version)
            .platform(request.platform)
            .build();

        agent = agentRepository.save(agent);

        // Mark enrollment code as used
        enrollmentService.markCodeUsed(enrollmentCode.getId(), agent.getId());

        // Issue tokens
        String refreshToken = generateRefreshToken();
        String refreshTokenHash = passwordEncoder.encode(refreshToken);

        SiteAgentCredential credential = SiteAgentCredential.builder()
            .agentId(agent.getId())
            .tokenHash(refreshTokenHash)
            .expiresAt(LocalDateTime.now().plusDays(REFRESH_TOKEN_VALIDITY_DAYS))
            .build();

        credentialRepository.save(credential);

        String accessToken = generateAccessToken(agent, enrollmentCode.getSiteId());

        log.info("Enrolled agent {} for site {} with fingerprint hash {}",
            agent.getId(), agent.getSiteId(), fingerprintHash);

        return new EnrollmentResult(agent, accessToken, refreshToken);
    }

    /**
     * Refresh access token using refresh token.
     */
    @Transactional
    public TokenRefreshResult refreshAccessToken(UUID agentId, String refreshToken) {
        SiteAgent agent = agentRepository.findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

        if (agent.getStatus() == SiteAgent.AgentStatus.revoked) {
            log.warn("Attempt to refresh token for revoked agent {}", agentId);
            throw new IllegalArgumentException("Agent revoked");
        }

        // Find matching active credential
        SiteAgentCredential matchingCredential = credentialRepository
            .findActiveCredentials(agentId, LocalDateTime.now())
            .stream()
            .filter(cred -> passwordEncoder.matches(refreshToken, cred.getTokenHash()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        // Update last used timestamp
        credentialRepository.updateLastUsedAt(matchingCredential.getId(), LocalDateTime.now());

        // Generate new access token
        String accessToken = generateAccessToken(agent, agent.getSiteId());

        log.debug("Refreshed access token for agent {}", agentId);

        return new TokenRefreshResult(accessToken);
    }

    /**
     * Revoke all credentials for an agent.
     */
    @Transactional
    public void revokeAgent(UUID agentId) {
        SiteAgent agent = agentRepository.findById(agentId)
            .orElseThrow(() -> new IllegalArgumentException("Agent not found"));

        agent.setStatus(SiteAgent.AgentStatus.revoked);
        agent.setRevokedAt(LocalDateTime.now());
        agentRepository.save(agent);

        credentialRepository.revokeAllByAgentId(agentId, LocalDateTime.now());

        log.info("Revoked agent {} and all credentials", agentId);
    }

    /**
     * Validate JWT access token and extract claims.
     */
    public AgentClaims validateAccessToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parserBuilder()
                .setSigningKey(key)
                .requireAudience(TOKEN_AUDIENCE)
                .build()
                .parseClaimsJws(token)
                .getBody();

            UUID agentId = UUID.fromString(claims.getSubject());
            UUID siteId = UUID.fromString(claims.get("siteId", String.class));
            UUID tenantId = UUID.fromString(claims.get("tenantId", String.class));

            return new AgentClaims(agentId, siteId, tenantId);
        } catch (Exception e) {
            log.warn("Token validation failed: {}", e.getMessage());
            throw new IllegalArgumentException("Invalid access token", e);
        }
    }

    private String generateAccessToken(SiteAgent agent, UUID siteId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

        // Get tenant ID from agent's site (would need site lookup, simplified here)
        // In real implementation, join with site table or pass tenantId

        Date now = new Date();
        Date expiry = new Date(now.getTime() + ACCESS_TOKEN_VALIDITY_HOURS * 3600 * 1000L);

        return Jwts.builder()
            .setSubject(agent.getId().toString())
            .setAudience(TOKEN_AUDIENCE)
            .claim("siteId", siteId.toString())
            .claim("agentId", agent.getId().toString())
            // TODO: Add tenantId claim after site lookup
            .setIssuedAt(now)
            .setExpiration(expiry)
            .signWith(key, SignatureAlgorithm.HS256)
            .compact();
    }

    private String generateRefreshToken() {
        byte[] tokenBytes = new byte[REFRESH_TOKEN_LENGTH];
        secureRandom.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    private String hashFingerprint(String fingerprint) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(fingerprint.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    // DTOs
    public record EnrollmentRequest(
        String enrollmentCode,
        String name,
        String deviceFingerprint,
        String version,
        String platform
    ) {}

    public record EnrollmentResult(
        SiteAgent agent,
        String accessToken,
        String refreshToken
    ) {}

    public record TokenRefreshResult(String accessToken) {}

    public record AgentClaims(
        UUID agentId,
        UUID siteId,
        UUID tenantId
    ) {}
}
