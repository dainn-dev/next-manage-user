package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.GateCreateRequest;
import com.vehiclemanagement.dto.GateDto;
import com.vehiclemanagement.dto.GateHealthDto;
import com.vehiclemanagement.dto.GateLaneDto;
import com.vehiclemanagement.dto.GateRegisterRequest;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.CameraRepository;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class GateService {

    @Autowired
    private GateRepository gateRepository;

    @Autowired
    private CameraRepository cameraRepository;

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

        return toDto(gateRepository.save(gate));
    }

    private Gate resolveForRegister(GateRegisterRequest request) {
        if (request.getId() != null) {
            Gate existing = gateRepository.findById(request.getId()).orElse(null);
            if (existing != null) {
                // Guard the unique name when renaming during re-registration.
                if (!existing.getName().equals(request.getName())
                        && gateRepository.existsByNameAndIdNot(request.getName(), existing.getId())) {
                    throw new ConflictException("Gate with name '" + request.getName() + "' already exists");
                }
                return existing;
            }
        }
        return gateRepository.findByName(request.getName()).orElseGet(Gate::new);
    }

    /**
     * Admin create: always inserts a new gate for the given facility. Name must be unique.
     */
    public GateDto create(GateCreateRequest request) {
        siteAccess.assertSiteAllowed(request.getSiteId());
        if (gateRepository.existsByName(request.getName().trim())) {
            throw new ConflictException("Gate with name '" + request.getName() + "' already exists");
        }

        Gate gate = Gate.builder()
                .siteId(request.getSiteId())
                .name(request.getName().trim())
                .gateType(request.getGateType())
                .location(request.getLocation())
                .cameraRtspUrl(request.getCameraRtspUrl())
                .status(request.getStatus() != null ? request.getStatus() : Gate.GateStatus.offline)
                .build();

        gate = gateRepository.save(gate);
        syncLanes(gate, request.getCameraIds());
        return toDto(gate);
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
        return toDto(gateRepository.save(gate));
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
        return gates.stream().map(this::toDto).collect(Collectors.toList());
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
        return toDto(gate);
    }

    /**
     * Admin config update: name, location, type, status and lane cameras.
     * Heartbeat timestamp is left untouched. When {@code cameraIds} is null, lanes
     * are left unchanged; an empty list clears all lanes.
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
            String nextName = request.getName().trim();
            if (!gate.getName().equals(nextName)
                    && gateRepository.existsByNameAndIdNot(nextName, id)) {
                throw new ConflictException("Gate with name '" + nextName + "' already exists");
            }
            gate.setName(nextName);
        }
        if (request.getLocation() != null) {
            gate.setLocation(request.getLocation());
        }
        if (request.getGateType() != null) {
            gate.setGateType(request.getGateType());
        }
        if (request.getCameraRtspUrl() != null) {
            gate.setCameraRtspUrl(request.getCameraRtspUrl());
        }
        if (request.getStatus() != null) {
            gate.setStatus(request.getStatus());
        }

        gate = gateRepository.save(gate);
        if (request.getCameraIds() != null) {
            syncLanes(gate, request.getCameraIds());
        } else if (request.getGateType() != null) {
            // Direction changed without lane list: refresh panel_type on existing lanes.
            syncLanes(gate, cameraRepository.findByGateId(gate.getId()).stream()
                    .map(Camera::getId)
                    .collect(Collectors.toList()));
        }
        return toDto(gate);
    }

    /**
     * Admin delete. Related camera / vehicle_log / access_request rows keep their
     * history via ON DELETE SET NULL FKs.
     */
    public void delete(UUID id) {
        Gate gate = gateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Gate not found with id: " + id));
        // Edge-registered gates may lack siteId; still allow tenant-scoped delete.
        if (gate.getSiteId() != null) {
            siteAccess.assertSiteAllowed(gate.getSiteId());
        }
        List<Camera> lanes = cameraRepository.findByGateId(id);
        for (Camera camera : lanes) {
            camera.setGateId(null);
        }
        if (!lanes.isEmpty()) {
            cameraRepository.saveAll(lanes);
        }
        gateRepository.delete(gate);
    }

    /**
     * Assign exactly one camera per lane. {@code cameraIds} order is preserved in
     * the response; duplicates are rejected. Cameras must belong to the gate site.
     */
    private void syncLanes(Gate gate, List<UUID> cameraIds) {
        List<UUID> desired = normalizeCameraIds(cameraIds);
        Camera.PanelType panelType = panelForGate(gate.getGateType());

        List<Camera> current = cameraRepository.findByGateId(gate.getId());
        Set<UUID> desiredSet = new HashSet<>(desired);

        for (Camera camera : current) {
            if (!desiredSet.contains(camera.getId())) {
                camera.setGateId(null);
            }
        }
        cameraRepository.saveAll(current);

        if (desired.isEmpty()) {
            return;
        }

        Map<UUID, Camera> byId = cameraRepository.findAllById(desired).stream()
                .collect(Collectors.toMap(Camera::getId, Function.identity()));
        if (byId.size() != desired.size()) {
            throw new ResourceNotFoundException("One or more cameras were not found");
        }

        List<Camera> toSave = new ArrayList<>();
        for (UUID cameraId : desired) {
            Camera camera = byId.get(cameraId);
            if (gate.getSiteId() != null && !gate.getSiteId().equals(camera.getSiteId())) {
                throw new IllegalArgumentException(
                        "Camera '" + camera.getName() + "' does not belong to this gate's site");
            }
            camera.setGateId(gate.getId());
            if (panelType != null) {
                camera.setPanelType(panelType);
                if (camera.getRole() == null) {
                    camera.setRole(Camera.CameraRole.ANPR_GATE);
                }
            }
            toSave.add(camera);
        }
        cameraRepository.saveAll(toSave);
    }

    private static List<UUID> normalizeCameraIds(List<UUID> cameraIds) {
        if (cameraIds == null || cameraIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<UUID> unique = new LinkedHashSet<>();
        for (UUID id : cameraIds) {
            if (id == null) {
                continue;
            }
            if (!unique.add(id)) {
                throw new IllegalArgumentException("Each lane must use a different camera");
            }
        }
        return new ArrayList<>(unique);
    }

    private static Camera.PanelType panelForGate(Gate.GateType gateType) {
        if (gateType == Gate.GateType.ENTRANCE) {
            return Camera.PanelType.entry;
        }
        if (gateType == Gate.GateType.EXIT) {
            return Camera.PanelType.exit;
        }
        return null;
    }

    private GateDto toDto(Gate gate) {
        GateDto dto = new GateDto(gate);
        List<Camera> cameras = cameraRepository.findByGateId(gate.getId());
        dto.setLanes(cameras.stream()
                .map(camera -> GateLaneDto.builder()
                        .cameraId(camera.getId())
                        .name(camera.getName())
                        .status(camera.getStatus())
                        .panelType(camera.getPanelType())
                        .build())
                .collect(Collectors.toList()));
        return dto;
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
