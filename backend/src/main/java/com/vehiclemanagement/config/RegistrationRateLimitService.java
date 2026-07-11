package com.vehiclemanagement.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

@Component
public class RegistrationRateLimitService {

    private final RegistrationRateLimitProperties properties;
    private final Cache<String, WindowCounter> counters;
    private final Clock clock;
    private final Counter allowedCounter;
    private final Counter rejectedCounter;

    public RegistrationRateLimitService(
            RegistrationRateLimitProperties properties,
            MeterRegistry meterRegistry) {
        this(properties, meterRegistry, Clock.systemUTC());
    }

    RegistrationRateLimitService(
            RegistrationRateLimitProperties properties,
            MeterRegistry meterRegistry,
            Clock clock) {
        this.properties = properties;
        this.clock = clock;
        this.counters = Caffeine.newBuilder()
                .maximumSize(Math.max(1, properties.getMaximumTrackedIps()))
                .expireAfterAccess(validDuration(properties.getBucketExpiry(), Duration.ofHours(1)))
                .build();
        this.allowedCounter = meterRegistry.counter("registration.rate_limit.requests", "outcome", "allowed");
        this.rejectedCounter = meterRegistry.counter("registration.rate_limit.requests", "outcome", "rejected");
    }

    public Decision tryAcquire(String clientKey) {
        if (!properties.isEnabled()) {
            return Decision.allowed(Math.max(1, properties.getCapacity()));
        }

        int capacity = Math.max(1, properties.getCapacity());
        long windowMillis = validDuration(properties.getRefillPeriod(), Duration.ofMinutes(15)).toMillis();
        long now = clock.millis();
        Decision decision = counters.asMap().compute(clientKey, (key, current) -> {
            WindowCounter window = current;
            if (window == null || now >= window.windowStartedAt + windowMillis) {
                window = new WindowCounter(now, 0);
            }
            if (window.used >= capacity) {
                long retryAfterMillis = Math.max(1, window.windowStartedAt + windowMillis - now);
                return window.withDecision(Decision.rejected(capacity, retryAfterMillis));
            }
            WindowCounter updated = new WindowCounter(window.windowStartedAt, window.used + 1);
            return updated.withDecision(Decision.allowed(capacity - updated.used));
        }).counter;

        if (decision.allowed()) {
            allowedCounter.increment();
        } else {
            rejectedCounter.increment();
        }
        return decision;
    }

    private static Duration validDuration(Duration configured, Duration fallback) {
        return configured == null || configured.isZero() || configured.isNegative() ? fallback : configured;
    }

    public record Decision(boolean allowed, int remaining, long retryAfterSeconds) {
        static Decision allowed(int remaining) {
            return new Decision(true, Math.max(0, remaining), 0);
        }

        static Decision rejected(int capacity, long retryAfterMillis) {
            long retryAfterSeconds = Math.max(1, (retryAfterMillis + 999) / 1000);
            return new Decision(false, 0, retryAfterSeconds);
        }
    }

    private static final class WindowCounter {
        private final long windowStartedAt;
        private final int used;
        private final Decision counter;

        private WindowCounter(long windowStartedAt, int used) {
            this(windowStartedAt, used, null);
        }

        private WindowCounter(long windowStartedAt, int used, Decision counter) {
            this.windowStartedAt = windowStartedAt;
            this.used = used;
            this.counter = counter;
        }

        private WindowCounter withDecision(Decision decision) {
            return new WindowCounter(windowStartedAt, used, decision);
        }
    }
}
