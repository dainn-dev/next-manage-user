package com.vehiclemanagement.config;

import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.repository.GateRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Custom Micrometer metrics for gate / vehicle observability (Phase 4.1).
 *
 * <p>Metrics are scraped from {@code /actuator/prometheus}. Endpoint protection:
 * the actuator surface is already {@code permitAll} in {@link SecurityConfig} (health
 * probes + metrics scraping) and these gate metrics carry no PII — only aggregate
 * counts and gate names. In production, restrict {@code :8080/actuator/**} at the
 * network layer so only the Prometheus server can reach it.
 *
 * <p>Exposed custom metrics:
 * <ul>
 *   <li>{@code gate_up} — gauge, number of gates currently online (this class).</li>
 *   <li>{@code vehicle_check_total{gate,result}} — counter, one per access check
 *       (recorded in {@code VehicleService}; Prometheus appends the {@code _total}
 *       suffix to the {@code vehicle_check} meter).</li>
 *   <li>{@code vehicle_check_latency_seconds} — timer around each access check
 *       (recorded in {@code VehicleService}).</li>
 * </ul>
 */
@Configuration
public class ObservabilityConfig {

    /** Prometheus gauge name for the online-gate count. */
    public static final String GATE_UP = "gate_up";

    /**
     * Gauge tracking the number of gates currently reporting online. It reads the
     * persisted gate status, which the heartbeat scheduler in {@code GateService}
     * keeps fresh within the {@code gate.heartbeat-timeout-seconds} window.
     */
    @Bean
    public Gauge gateUpGauge(MeterRegistry registry, GateRepository gateRepository) {
        return Gauge.builder(GATE_UP, gateRepository,
                        repo -> repo.countByStatus(Gate.GateStatus.online))
                .description("Number of gates currently reporting online")
                .register(registry);
    }
}
