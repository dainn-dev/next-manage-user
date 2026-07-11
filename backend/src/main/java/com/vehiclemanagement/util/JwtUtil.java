package com.vehiclemanagement.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class JwtUtil {
    
    @Value("${jwt.secret}")
    private String secret;
    
    @Value("${jwt.expiration:86400}") // 24 hours in seconds
    private Long expiration;
    
    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }
    
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }
    
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }
    
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }
    
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
    
    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }
    
    public String generateToken(UserDetails userDetails) {
        return createToken(withPasswordVersion(new HashMap<>(), userDetails), userDetails.getUsername());
    }

    public String generateToken(UserDetails userDetails, Map<String, Object> extraClaims) {
        return createToken(withPasswordVersion(new HashMap<>(extraClaims), userDetails), userDetails.getUsername());
    }

    private Map<String, Object> withPasswordVersion(Map<String, Object> claims, UserDetails userDetails) {
        if (userDetails instanceof com.vehiclemanagement.entity.User user) {
            claims.put("password_version", user.getPasswordVersion());
        }
        return claims;
    }
    
    private String createToken(Map<String, Object> claims, String subject) {
        Instant now = Instant.now();
        Instant expirationTime = now.plus(expiration, ChronoUnit.SECONDS);
        
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(expirationTime))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }
    
    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        if (!username.equals(userDetails.getUsername()) || isTokenExpired(token)) {
            return false;
        }
        if (userDetails instanceof com.vehiclemanagement.entity.User user) {
            Integer tokenPasswordVersion = extractPasswordVersion(token);
            return tokenPasswordVersion != null && tokenPasswordVersion == user.getPasswordVersion();
        }
        return false;
    }
    
    public Boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
    
    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }
    
    public String extractEmail(String token) {
        return extractClaim(token, claims -> claims.get("email", String.class));
    }

    public Integer extractPasswordVersion(String token) {
        return extractClaim(token, claims -> claims.get("password_version", Integer.class));
    }

    /**
     * The tenant the token is scoped to, or {@code null} for a PLATFORM_ADMIN
     * (cross-tenant) token or a legacy token issued before multi-tenancy. The
     * claim is stored as the tenant UUID string at issuance (see AuthService).
     */
    public UUID extractTenantId(String token) {
        String tenantId = extractClaim(token, claims -> claims.get("tenant_id", String.class));
        return tenantId != null ? UUID.fromString(tenantId) : null;
    }

    /**
     * The sites the token grants access to (empty for a legacy token, or for a
     * tenant-wide role such as TENANT_ADMIN/PLATFORM_ADMIN that is not
     * site-restricted). Used by the app-layer site-scoping check, not by RLS.
     */
    public List<UUID> extractSiteIds(String token) {
        List<?> raw = extractClaim(token, claims -> claims.get("site_ids", List.class));
        if (raw == null) {
            return Collections.emptyList();
        }
        return raw.stream()
                .map(Object::toString)
                .map(UUID::fromString)
                .collect(Collectors.toList());
    }

    /**
     * Active tenant affiliations for a platform {@code MEMBER} (ADR-0603 Phase B).
     * Empty for ops roles / legacy tokens.
     */
    public List<UUID> extractAffiliationTenantIds(String token) {
        List<?> raw = extractClaim(token, claims -> claims.get("affiliation_tenant_ids", List.class));
        if (raw == null) {
            return Collections.emptyList();
        }
        return raw.stream()
                .map(Object::toString)
                .map(UUID::fromString)
                .collect(Collectors.toList());
    }
    
    public Date getExpirationDate() {
        Instant now = Instant.now();
        Instant expirationTime = now.plus(expiration, ChronoUnit.SECONDS);
        return Date.from(expirationTime);
    }
    
    public long getExpirationSeconds() {
        return expiration;
    }
}
