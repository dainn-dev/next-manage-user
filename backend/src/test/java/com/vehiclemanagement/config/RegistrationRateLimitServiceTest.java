package com.vehiclemanagement.config;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RegistrationRateLimitServiceTest {

    @Test
    void limitsEachClientIndependently() {
        RegistrationRateLimitProperties properties = properties(2);
        RegistrationRateLimitService service = new RegistrationRateLimitService(
                properties,
                new SimpleMeterRegistry(),
                Clock.fixed(Instant.parse("2026-07-11T00:00:00Z"), ZoneOffset.UTC));

        assertThat(service.tryAcquire("192.0.2.1").allowed()).isTrue();
        assertThat(service.tryAcquire("192.0.2.1").allowed()).isTrue();
        RegistrationRateLimitService.Decision rejected = service.tryAcquire("192.0.2.1");
        assertThat(rejected.allowed()).isFalse();
        assertThat(rejected.retryAfterSeconds()).isEqualTo(60);
        assertThat(service.tryAcquire("192.0.2.2").allowed()).isTrue();
    }

    @Test
    void disabledLimiterAlwaysAllowsRequests() {
        RegistrationRateLimitProperties properties = properties(1);
        properties.setEnabled(false);
        RegistrationRateLimitService service = new RegistrationRateLimitService(
                properties,
                new SimpleMeterRegistry(),
                Clock.fixed(Instant.parse("2026-07-11T00:00:00Z"), ZoneOffset.UTC));

        assertThat(service.tryAcquire("192.0.2.1").allowed()).isTrue();
        assertThat(service.tryAcquire("192.0.2.1").allowed()).isTrue();
    }

    private RegistrationRateLimitProperties properties(int capacity) {
        RegistrationRateLimitProperties properties = new RegistrationRateLimitProperties();
        properties.setCapacity(capacity);
        properties.setRefillPeriod(Duration.ofMinutes(1));
        properties.setBucketExpiry(Duration.ofMinutes(5));
        return properties;
    }
}
