package com.vehiclemanagement.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class TenantSlugNormalizer {

    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_SLUG_CHARACTERS = Pattern.compile("[^a-z0-9]+");
    private static final Pattern EDGE_HYPHENS = Pattern.compile("(^-|-$)");
    private static final int MAX_SLUG_LENGTH = 100;

    private TenantSlugNormalizer() {
    }

    public static String normalize(String source) {
        if (source == null || source.isBlank()) {
            throw new IllegalArgumentException("Tenant name or slug must contain at least one letter or number");
        }

        String trimmed = source.trim();
        String normalized = Normalizer.normalize(trimmed, Normalizer.Form.NFD)
                .replace('đ', 'd')
                .replace('Đ', 'D');
        normalized = COMBINING_MARKS.matcher(normalized).replaceAll("")
                .toLowerCase(Locale.ROOT);

        String slug = EDGE_HYPHENS.matcher(
                        NON_SLUG_CHARACTERS.matcher(normalized).replaceAll("-"))
                .replaceAll("");
        if (!slug.isBlank()) {
            return bound(slug);
        }

        String unicodeSlug = trimmed.codePoints()
                .filter(Character::isLetterOrDigit)
                .mapToObj(codePoint -> Integer.toString(codePoint, 36))
                .collect(Collectors.joining("-"));
        if (unicodeSlug.isBlank()) {
            throw new IllegalArgumentException("Tenant name or slug must contain at least one letter or number");
        }
        return bound("org-" + unicodeSlug);
    }

    private static String bound(String slug) {
        if (slug.length() <= MAX_SLUG_LENGTH) {
            return slug;
        }
        String suffix = "-" + shortHash(slug);
        return slug.substring(0, MAX_SLUG_LENGTH - suffix.length()) + suffix;
    }

    private static String shortHash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(12);
            for (int i = 0; i < 6; i++) {
                hex.append(String.format("%02x", digest[i] & 0xff));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
