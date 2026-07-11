package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.PasswordResetConfirmRequest;
import com.vehiclemanagement.dto.PasswordResetRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String GENERIC_MESSAGE =
            "If an account exists, a password reset email will be sent.";
    private static final String INVALID_TOKEN_MESSAGE = "Invalid or expired password reset token";

    private final PasswordResetStore store;
    private final PasswordResetEmailSender emailSender;
    private final PasswordResetProperties properties;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom;
    private final byte[] fingerprintKey;

    public PasswordResetService(
            PasswordResetStore store,
            PasswordResetEmailSender emailSender,
            PasswordResetProperties properties,
            PasswordEncoder passwordEncoder) {
        this.store = store;
        this.emailSender = emailSender;
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
        this.secureRandom = new SecureRandom();
        properties.validate();
        this.fingerprintKey = properties.getFingerprintSecret().getBytes(StandardCharsets.UTF_8);
    }

    public String requestReset(PasswordResetRequest request, String remoteAddress) {
        String normalizedEmail = normalizeEmail(request.email());
        String normalizedIp = normalizeIp(remoteAddress);
        String emailFingerprint = fingerprint(normalizedEmail);
        String ipFingerprint = fingerprint(normalizedIp);
        String rawToken = generateOpaqueToken();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        Optional<PasswordResetStore.PendingDelivery> pending = store.createRequest(
                normalizedEmail,
                emailFingerprint,
                ipFingerprint,
                sha256(rawToken),
                now,
                now.plus(properties.getTokenTtl()),
                now.minus(properties.getRateLimitWindow()),
                properties.getEmailLimit(),
                properties.getIpLimit());
        if (pending.isEmpty()) {
            return GENERIC_MESSAGE;
        }

        String resetUrl = appendToken(properties.getResetUrl(), rawToken);
        try {
            emailSender.sendPasswordReset(pending.get().email(), resetUrl);
        } catch (RuntimeException ex) {
            store.revoke(pending.get().tokenId(), OffsetDateTime.now(ZoneOffset.UTC));
        }
        return GENERIC_MESSAGE;
    }

    public void confirmReset(PasswordResetConfirmRequest request) {
        String tokenHash = sha256(request.token());
        String encodedPassword = passwordEncoder.encode(request.newPassword());
        boolean changed = store.consume(tokenHash, encodedPassword, OffsetDateTime.now(ZoneOffset.UTC));
        if (!changed) {
            throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeIp(String ip) {
        return ip == null || ip.isBlank() ? "unknown" : ip.trim();
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String appendToken(String baseUrl, String token) {
        return baseUrl + (baseUrl.contains("?") ? "&" : "?") + "token=" + token;
    }

    private String sha256(String value) {
        try {
            return hex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private String fingerprint(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(fingerprintKey, HMAC_ALGORITHM));
            return hex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to fingerprint password reset request", ex);
        }
    }

    private String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            result.append(Character.forDigit((value >>> 4) & 0x0f, 16));
            result.append(Character.forDigit(value & 0x0f, 16));
        }
        return result.toString();
    }
}
