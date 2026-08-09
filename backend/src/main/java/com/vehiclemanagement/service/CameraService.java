package com.vehiclemanagement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.billing.EntitlementGuard;
import com.vehiclemanagement.config.CameraCredentialProperties;
import com.vehiclemanagement.config.PlatformAdminOperation;
import com.vehiclemanagement.dto.CameraCreateRequest;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.entity.Zone;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.parking.CameraRealtimePublisher;
import com.vehiclemanagement.repository.CameraRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.ZoneRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tenant-scoped Camera CRUD. All rows are confined to the current tenant by RLS.
 * Two business rules are enforced here on top of that:
 * <ul>
 *   <li>Camera names are unique within a site (409 on violation).</li>
 *   <li>An assigned zone must belong to the same site as the camera (400).</li>
 *   <li>OVERVIEW cameras are site-scoped; zones are owned by their map slots.</li>
 * </ul>
 * The per-camera credential fields are never touched by this CRUD surface — key
 * issuance/rotation (ADR-0602) is a separate flow.
 */
@Service
@Transactional
public class CameraService {

    @Autowired
    private CameraRepository cameraRepository;

    @Autowired
    private SiteRepository siteRepository;

    @Autowired
    private ZoneRepository zoneRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EntitlementGuard entitlementGuard;

    @Autowired
    private SiteAccess siteAccess;

    @Autowired
    private CameraCredentialProperties credentialProperties;

    @Autowired
    private OutboxBus outboxBus;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CameraRealtimePublisher cameraRealtimePublisher;

    @Value("${camera.heartbeat-timeout-seconds:60}")
    private long heartbeatTimeoutSeconds;

    private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();

    @Transactional(readOnly = true)
    public List<CameraDto> list(UUID siteId) {
        if (siteId != null) {
            siteAccess.assertSiteAllowed(siteId);
        }
        List<Camera> cameras = siteId != null
                ? cameraRepository.findBySiteId(siteId)
                : cameraRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        if (siteId == null && siteAccess.isRestricted()) {
            List<UUID> allowed = siteAccess.allowedSiteIds();
            cameras = cameras.stream()
                    .filter(c -> allowed.contains(c.getSiteId()))
                    .collect(Collectors.toList());
        }
        return cameras.stream().map(CameraDto::new).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CameraDto get(UUID id) {
        Camera camera = findOrThrow(id);
        siteAccess.assertSiteAllowed(camera.getSiteId());
        return new CameraDto(camera);
    }

    public CameraDto create(CameraDto request) {
        requireSite(request.getSiteId());
        Camera.CameraRole role = request.getRole() == null
                ? Camera.CameraRole.ANPR_GATE
                : request.getRole();
        UUID zoneId = zoneForRole(role, request.getZoneId());
        validateZone(zoneId, request.getSiteId());
        if (cameraRepository.existsBySiteIdAndName(request.getSiteId(), request.getName())) {
            throw new ConflictException("Camera with name '" + request.getName()
                    + "' already exists in this site");
        }
        entitlementGuard.assertCameraCreationAllowed(request.getSiteId());

        Camera camera = Camera.builder()
                .siteId(request.getSiteId())
                .zoneId(zoneId)
                .name(request.getName())
                .streamKind(request.getStream() == null ? null : request.getStream().kind())
                .streamUrl(request.getStream() == null ? null : browserUrl(request.getStream().url(), false))
                .streamExpiresAt(request.getStream() == null ? null : request.getStream().expiresAt())
                .snapshotUrl(browserUrl(request.getSnapshotUrl(), true))
                .calibrationJson(request.getCalibrationJson())
                .build();
        applySource(camera, request.getSourceType(), request.getSourceUrl(), request.getRtspUrl(), false);
        camera.setRole(role);
        camera.setPanelType(panelForRole(role, request.getPanelType()));
        if (request.getStatus() != null) {
            camera.setStatus(request.getStatus());
        }
        return new CameraDto(cameraRepository.save(camera));
    }

    /**
     * Compatibility enrollment API: enforces the tenant camera entitlement and
     * returns the raw ingest key exactly once. The CRUD endpoint intentionally does
     * not issue credentials.
     */
    public CameraWithKeyDto create(UUID siteId, CameraCreateRequest request) {
        requireSite(siteId);
        Camera.CameraRole role = request.getRole() == null
                ? Camera.CameraRole.ANPR_GATE
                : request.getRole();
        UUID zoneId = zoneForRole(role, request.getZoneId());
        validateZone(zoneId, siteId);
        if (cameraRepository.existsBySiteIdAndName(siteId, request.getName())) {
            throw new ConflictException("Camera with name '" + request.getName()
                    + "' already exists in this site");
        }
        entitlementGuard.assertCameraCreationAllowed(siteId);

        String ingestKey = newIngestKey();
        Camera camera = Camera.builder()
                .siteId(siteId)
                .zoneId(zoneId)
                .name(request.getName())
                .role(role)
                .panelType(panelForRole(role, request.getPanelType()))
                .status(Camera.CameraStatus.provisioned)
                .apiKeyHash(passwordEncoder.encode(ingestKey))
                .build();
        applySource(camera, request.getSourceType(), request.getSourceUrl(), request.getRtspUrl(), false);
        return new CameraWithKeyDto(cameraRepository.save(camera), ingestKey);
    }

    /**
     * Issues a first credential for an existing camera. This additive operation
     * keeps the ordinary CRUD response free of secrets while allowing cameras
     * created through the original CRUD endpoint to be enrolled safely.
     */
    public CameraWithKeyDto issueKey(UUID id) {
        Camera camera = cameraRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Camera not found with id: " + id));
        siteAccess.assertSiteAllowed(camera.getSiteId());
        if (camera.getApiKeyHash() != null) {
            throw new ConflictException("Camera already has an active credential; rotate it instead");
        }
        return saveNewActiveKey(camera, null);
    }

    /**
     * Atomically rotates a camera credential. The old active hash is retained
     * for the configured grace period so an edge process can update without a
     * hard cutover. A pessimistic repository lock serializes concurrent rotates.
     */
    public CameraWithKeyDto rotateKey(UUID id) {
        Camera camera = cameraRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Camera not found with id: " + id));
        siteAccess.assertSiteAllowed(camera.getSiteId());
        if (camera.getApiKeyHash() == null) {
            return saveNewActiveKey(camera, null);
        }

        LocalDateTime previousExpiresAt = LocalDateTime.now()
                .plus(validGracePeriod());
        camera.setPreviousApiKeyHash(camera.getApiKeyHash());
        camera.setPreviousApiKeyExpiresAt(previousExpiresAt);
        return saveNewActiveKey(camera, previousExpiresAt);
    }

    /** Marks a camera online after a credential-authenticated edge heartbeat. */
    public CameraDto heartbeat(UUID id) {
        Camera camera = findOrThrow(id);
        siteAccess.assertSiteAllowed(camera.getSiteId());
        camera.setLastHeartbeatAt(LocalDateTime.now());
        if (camera.getStatus() != Camera.CameraStatus.disabled) {
            camera.setStatus(Camera.CameraStatus.online);
        }
        Camera saved = cameraRepository.save(camera);
        cameraRealtimePublisher.publishHealthAfterCommit(saved);
        return new CameraDto(saved);
    }

    /**
     * Marks online cameras offline when they have not sent a heartbeat within the
     * configured timeout. This runs through the platform-admin datasource because
     * scheduled work has no request-bound tenant context.
     */
    @Scheduled(fixedRateString = "${camera.heartbeat-check-rate-ms:30000}")
    @PlatformAdminOperation
    public void markStaleCamerasOffline() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(heartbeatTimeoutSeconds);
        List<Camera> stale = cameraRepository.findByStatusAndLastHeartbeatAtBefore(
                Camera.CameraStatus.online, cutoff);
        if (stale.isEmpty()) {
            return;
        }
        stale.forEach(camera -> camera.setStatus(Camera.CameraStatus.offline));
        cameraRepository.saveAll(stale);
        cameraRepository.flush();
        stale.forEach(camera -> {
            cameraRealtimePublisher.publishHealthAfterCommit(camera);
            UUID tenantId = jdbcTemplate.queryForObject("SELECT tenant_id FROM camera WHERE id=?", UUID.class, camera.getId());
            UUID sourceId = UUID.nameUUIDFromBytes(("camera-offline:" + camera.getId() + ":"
                    + camera.getLastHeartbeatAt()).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var payload = objectMapper.createObjectNode();
            payload.put("event_id", sourceId.toString());
            payload.put("event_type", "CameraOffline");
            payload.put("tenant_id", tenantId.toString());
            payload.put("site_id", camera.getSiteId().toString());
            payload.put("camera_id", camera.getId().toString());
            payload.put("last_heartbeat_at", String.valueOf(camera.getLastHeartbeatAt()));
            outboxBus.publish(new OutboxBus.OutboxEvent(sourceId, tenantId,
                    tenantId + "." + camera.getSiteId() + ".CameraOffline", payload));
        });
    }

    private CameraWithKeyDto saveNewActiveKey(Camera camera, LocalDateTime previousExpiresAt) {
        String ingestKey = newIngestKey();
        camera.setApiKeyHash(passwordEncoder.encode(ingestKey));
        Camera saved = cameraRepository.save(camera);
        return new CameraWithKeyDto(saved, ingestKey, previousExpiresAt);
    }

    private String newIngestKey() {
        byte[] keyBytes = new byte[32];
        SECURE_RANDOM.nextBytes(keyBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(keyBytes);
    }

    private Duration validGracePeriod() {
        Duration configured = credentialProperties.getRotationGracePeriod();
        return configured == null || configured.isNegative() || configured.isZero()
                ? Duration.ofHours(24)
                : configured;
    }

    static UUID zoneForRole(Camera.CameraRole role, UUID requestedZoneId) {
        return role == Camera.CameraRole.OVERVIEW ? null : requestedZoneId;
    }

    static Camera.PanelType panelForRole(Camera.CameraRole role, Camera.PanelType requestedPanelType) {
        return role == Camera.CameraRole.OVERVIEW ? null : requestedPanelType;
    }

    public CameraDto update(UUID id, CameraDto request) {
        Camera camera = findOrThrow(id);
        siteAccess.assertSiteAllowed(camera.getSiteId());
        Camera.CameraRole effectiveRole = request.getRole() == null ? camera.getRole() : request.getRole();
        // The owning site is immutable; the zone may be re-assigned but must stay
        // within that same site.
        if (request.getName() != null && !request.getName().isBlank()
                && !camera.getName().equals(request.getName())) {
            if (cameraRepository.existsBySiteIdAndNameAndIdNot(camera.getSiteId(), request.getName(), id)) {
                throw new ConflictException("Camera with name '" + request.getName()
                        + "' already exists in this site");
            }
            camera.setName(request.getName());
        }
        if (effectiveRole == Camera.CameraRole.OVERVIEW) {
            // Zone ownership belongs to map slots. One OVERVIEW camera may cover
            // several zones in the same site, so it must remain site-scoped.
            camera.setZoneId(null);
        } else if (request.getZoneId() != null) {
            validateZone(request.getZoneId(), camera.getSiteId());
            camera.setZoneId(request.getZoneId());
        }
        if (request.getRtspUrl() != null || request.getSourceUrl() != null || request.getSourceType() != null) {
            applySource(camera, request.getSourceType(), request.getSourceUrl(), request.getRtspUrl(), true);
        }
        if (request.getStream() != null) {
            camera.setStreamKind(request.getStream().kind());
            camera.setStreamUrl(browserUrl(request.getStream().url(), false));
            camera.setStreamExpiresAt(request.getStream().expiresAt());
        }
        if (request.getSnapshotUrl() != null) {
            camera.setSnapshotUrl(browserUrl(request.getSnapshotUrl(), true));
        }
        if (request.getRole() != null) {
            camera.setRole(request.getRole());
        }
        if (effectiveRole == Camera.CameraRole.OVERVIEW) {
            // Clear stale entry/exit semantics when changing a camera to OVERVIEW.
            camera.setPanelType(null);
        } else if (request.getPanelType() != null) {
            camera.setPanelType(request.getPanelType());
        }
        if (request.getStatus() != null) {
            camera.setStatus(request.getStatus());
        }
        if (request.getCalibrationJson() != null) {
            camera.setCalibrationJson(request.getCalibrationJson());
        }
        return new CameraDto(cameraRepository.save(camera));
    }

    public void delete(UUID id) {
        Camera camera = findOrThrow(id);
        siteAccess.assertSiteAllowed(camera.getSiteId());
        cameraRepository.delete(camera);
    }

    private Camera findOrThrow(UUID id) {
        return cameraRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Camera not found with id: " + id));
    }

    private String browserUrl(String value, boolean allowRelative) {
        if (value == null || value.isBlank()) return null;
        if (allowRelative && value.startsWith("/") && !value.startsWith("//")) return value;
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (uri.getHost() == null || !("http".equalsIgnoreCase(scheme)
                    || "https".equalsIgnoreCase(scheme) || "wss".equalsIgnoreCase(scheme))) {
                throw new IllegalArgumentException("Browser media URL must use http, https, or wss");
            }
            return value;
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid browser media URL", exception);
        }
    }

    private void requireSite(UUID siteId) {
        // RLS confines this lookup to the current tenant, so a cross-tenant site
        // reads as absent — a camera can never attach to another tenant's site.
        if (!siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        siteAccess.assertSiteAllowed(siteId);
    }

    /**
     * Applies edge source type/url. {@code rtspUrl} remains mirrored for RTSP rows so
     * older edge configs keep working; HTTP (DroidCam) clears {@code rtsp_url}.
     */
    private void applySource(
            Camera camera,
            Camera.SourceType requestedType,
            String requestedSourceUrl,
            String requestedRtspUrl,
            boolean bumpRevision) {
        Camera.SourceType type = requestedType != null
                ? requestedType
                : (camera.getSourceType() != null ? camera.getSourceType() : Camera.SourceType.rtsp);

        String url = blankToNull(requestedSourceUrl);
        if (url == null) {
            url = blankToNull(requestedRtspUrl);
        }
        // Explicit clear: empty string on update with type present and no URL fields
        // is handled by callers only when at least one source field is sent.
        if (url == null && requestedSourceUrl == null && requestedRtspUrl == null) {
            url = blankToNull(camera.getSourceUrl());
            if (url == null) {
                url = blankToNull(camera.getRtspUrl());
            }
        }
        if (requestedSourceUrl != null && requestedSourceUrl.isBlank()) {
            url = null;
        } else if (requestedSourceUrl == null && requestedRtspUrl != null && requestedRtspUrl.isBlank()
                && type == Camera.SourceType.rtsp) {
            url = null;
        }

        validateSource(type, url);

        boolean changed = camera.getSourceType() != type
                || !java.util.Objects.equals(blankToNull(camera.getSourceUrl()), url)
                || (type == Camera.SourceType.rtsp
                    && !java.util.Objects.equals(blankToNull(camera.getRtspUrl()), url))
                || (type == Camera.SourceType.http && camera.getRtspUrl() != null);

        camera.setSourceType(type);
        camera.setSourceUrl(url);
        if (type == Camera.SourceType.rtsp) {
            camera.setRtspUrl(url);
        } else {
            camera.setRtspUrl(null);
        }
        if (bumpRevision && changed) {
            int current = camera.getConfigVersion() == null ? 1 : camera.getConfigVersion();
            camera.setConfigVersion(current + 1);
        }
    }

    private void validateSource(Camera.SourceType type, String url) {
        if (url == null) {
            return;
        }
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid camera source URL", ex);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (type == Camera.SourceType.rtsp) {
            if (!"rtsp".equals(scheme) && !"rtsps".equals(scheme)) {
                throw new IllegalArgumentException("RTSP source URL must use rtsp:// or rtsps://");
            }
        } else if (type == Camera.SourceType.http) {
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                throw new IllegalArgumentException("HTTP source URL must use http:// or https://");
            }
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("Camera source URL must include a host");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * A zone assignment is optional, but when present the zone must exist and belong
     * to the same site as the camera. Rejected with 400 otherwise.
     */
    private void validateZone(UUID zoneId, UUID siteId) {
        if (zoneId == null) {
            return;
        }
        Zone zone = zoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("Zone not found with id: " + zoneId));
        if (!zone.getSiteId().equals(siteId)) {
            throw new IllegalArgumentException(
                    "Zone " + zoneId + " does not belong to site " + siteId);
        }
    }
}
