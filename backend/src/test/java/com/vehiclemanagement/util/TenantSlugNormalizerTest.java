package com.vehiclemanagement.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TenantSlugNormalizerTest {

    @Test
    void normalizesUppercaseVietnameseAndPunctuation() {
        assertThat(TenantSlugNormalizer.normalize("E2E Tenant")).isEqualTo("e2e-tenant");
        assertThat(TenantSlugNormalizer.normalize("Nhà trọ Ánh Dương"))
                .isEqualTo("nha-tro-anh-duong");
        assertThat(TenantSlugNormalizer.normalize("Đỗ Xe")).isEqualTo("do-xe");
        assertThat(TenantSlugNormalizer.normalize("  Acme___Parking!!! "))
                .isEqualTo("acme-parking");
    }

    @Test
    void usesDeterministicFallbackForNonLatinNames() {
        String first = TenantSlugNormalizer.normalize("東京");
        String second = TenantSlugNormalizer.normalize("東京");

        assertThat(first).startsWith("org-").isEqualTo(second);
    }

    @Test
    void rejectsNamesWithoutLettersOrNumbers() {
        assertThatThrownBy(() -> TenantSlugNormalizer.normalize("--- !!!"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("letter or number");
    }

    @Test
    void boundsLongSlugsWithStableDistinctHashes() {
        String prefix = "a".repeat(120);
        String first = TenantSlugNormalizer.normalize(prefix + "x");
        String repeated = TenantSlugNormalizer.normalize(prefix + "x");
        String second = TenantSlugNormalizer.normalize(prefix + "y");

        assertThat(first).hasSize(100).isEqualTo(repeated);
        assertThat(second).hasSize(100).isNotEqualTo(first);
    }
}
