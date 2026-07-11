package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.GateDto;
import com.vehiclemanagement.dto.GateHealthDto;
import com.vehiclemanagement.dto.GateRegisterRequest;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.GateRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class GateService {

    @Autowired
    private GateRepository gateRepository;

    @Autowired
    private SiteAccess siteAccess;

    /**
     * Seconds without a heartbeat before an online gate is flagged offline.
     */
    @Value("${gate.heartbeat-timeout-seconds:60}")
    private long heartbeatTimeoutSeconds;

    /**
     * Register (upsert) a gate. Matches an existing gate by id when provided,
     * otherwise by unique name. Marks the gate online and stamps the heartbeat.
     */
    public GateDto register(GateRegisterRequest request) {
        Gate gate = resolveForRegister(request);

        gate.setName(request.getName());
        gate.setLocation(request.getLocation());
        gate.setCameraRtspUrl(request.getCameraRtspUrl());
        // Registration counts as liveness, but never override a disabled gate.
        if (gate.getStatus() != Gate.GateStatus.disabled) {
            gate.setStatus(Gate.GateStatus.online);
        }
        gate.setLastHeartbeatAt(LocalDateTime.now());

        return new GateDto(gateRepository.save(gate));
    }

    private Gate resolveForRegister(GateRegisterRequest request) {
        if (request.getId() != null) {
            Gate existing = gateRepository.findById(request.getId()).orElse(null);
            if (existing != null) {
                // Guard the unique name when renaming during re-registration.
                if (!existing.getName().equals(request.getName())
                        && gateRepository.existsByNameAndIdNot(request.getName(), existing.getId())) {
                    throw new IllegalArgumentException("Gate with name '" + request.getName() + "' already exists");
                }
                return existing;
            }
        }
        return gateRepository.findByName(request.getName()).orElseGet(Gate::new);
    }

    /**
     * Record a heartbeat: refresh the timestamp and mark the gate online
     * (unless it has been administratively disabled).
     */
    public GateDto heartbeat(UUID id) {
        Gate gate = gateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gate not found with id: " + id));

        gate.setLastHeartbeatAt(LocalDateTime.now());
        if (gate.getStatus() != Gate.GateStatus.disabled) {
            gate.setStatus(Gate.GateStatus.online);
        }
        return new GateDto(gateRepository.save(gate));
    }

    /**
     * List all gates ordered by name.
     */
    @Transactional(readOnly = true)
    public List<GateDto> list() {
        Sort sort = Sort.by(Sort.Direction.ASC, "name");
        List<Gate> gates = siteAccess.isRestricted()
                ? gateRepository.findBySiteIdIn(siteAccess.allowedSiteIds(), sort)
                : gateRepository.findAll(sort);
        return gates.stream().map(GateDto::new).collect(Collectors.toList());
    }

    /**
     * Per-gate health summary: each gate with its computed freshness. The offline
     * threshold reuses {@code gate.heartbeat-timeout-seconds} — the same window the
     * {@link #markStaleGatesOffline()} scheduler uses — so the {@code online} flag
     * here agrees with the persisted status even between scheduler ticks.
     */
    @Transactional(readOnly = true)
    public List<GateHealthDto> health() {
        LocalDateTime now = LocalDateTime.now();
        Sort sort = Sort.by(Sort.Direction.ASC, "name");
        List<Gate> gates = siteAccess.isRestricted()
                ? gateRepository.findBySiteIdIn(siteAccess.allowedSiteIds(), sort)
                : gateRepository.findAll(sort);
        return gates.stream()
                .map(gate -> toHealth(gate, now))
                .collect(Collectors.toList());
    }

    private GateHealthDto toHealth(Gate gate, LocalDateTime now) {
        Long secondsSince = gate.getLastHeartbeatAt() == null
                ? null
                : Math.max(0, Duration.between(gate.getLastHeartbeatAt(), now).getSeconds());
        boolean online = gate.getStatus() != Gate.GateStatus.disabled
                && secondsSince != null
                && secondsSince <= heartbeatTimeoutSeconds;
        return GateHealthDto.builder()
                .id(gate.getId())
                .name(gate.getName())
                .location(gate.getLocation())
                .status(gate.getStatus())
                .lastHeartbeatAt(gate.getLastHeartbeatAt())
                .secondsSinceHeartbeat(secondsSince)
                .online(online)
                .build();
    }

    /**
     * Get a single gate by id.
     */
    @Transactional(readOnly = true)
    public GateDto get(UUID id) {
        Gate gate = gateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gate not found with id: " + id));
        siteAccess.assertSiteAllowed(gate.getSiteId());
        return new GateDto(gate);
    }

    /**
     * Admin config update: name, location, camera URL and status. Heartbeat
     * timestamp is left untouched.
     */
    public GateDto updateConfig(UUID id, GateDto request) {
        Gate gate = gateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gate not found with id: " + id));
        siteAccess.assertSiteAllowed(gate.getSiteId());

        if (request.getSiteId() != null && !request.getSiteId().equals(gate.getSiteId())) {
            siteAccess.assertSiteAllowed(request.getSiteId());
            gate.setSiteId(request.getSiteId());
        }

        if (request.getName() != null && !request.getName().isBlank()) {
            if (!gate.getName().equals(request.getName())
                    && gateRepository.existsByNameAndIdNot(request.getName(), id)) {
                throw new IllegalArgumentException("Gate with name '" + request.getName() + "' already exists");
            }
            gate.setName(request.getName());
        }
        if (request.getLocation() != null) {
            gate.setLocation(request.getLocation());
        }
        if (request.getCameraRtspUrl() != null) {
            gate.setCameraRtspUrl(request.getCameraRtspUrl());
        }
        if (request.getStatus() != null) {
            gate.setStatus(request.getStatus());
        }

        return new GateDto(gateRepository.save(gate));
    }

    /**
     * Flag online gates whose heartbeat has gone stale as offline. Runs every
     * 30 seconds; the staleness window is {@code gate.heartbeat-timeout-seconds}.
     */
    @Scheduled(fixedRateString = "${gate.heartbeat-check-rate-ms:30000}")
    public void markStaleGatesOffline() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusSeconds(heartbeatTimeoutSeconds);
            List<Gate> stale = gateRepository
                    .findByStatusAndLastHeartbeatAtBefore(Gate.GateStatus.online, cutoff);
            if (stale.isEmpty()) {
                return;
            }
            stale.forEach(gate -> gate.setStatus(Gate.GateStatus.offline));
            gateRepository.saveAll(stale);
            System.out.println("Gate heartbeat check: marked " + stale.size() + " gate(s) offline.");
        } catch (Exception e) {
            System.err.println("Error during gate heartbeat check: " + e.getMessage());
        }
    }
}
