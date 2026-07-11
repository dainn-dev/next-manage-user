package com.vehiclemanagement.service;

import com.vehiclemanagement.billing.EntitlementGuard;
import com.vehiclemanagement.dto.CameraCreateRequest;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.entity.Zone;
import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.CameraRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.repository.ZoneRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tenant-scoped Camera CRUD. All rows are confined to the current tenant by RLS.
 * Two business rules are enforced here on top of that:
 * <ul>
 *   <li>Camera names are unique within a site (409 on violation).</li>
 *   <li>An assigned zone must belong to the same site as the camera (400).</li>
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
        validateZone(request.getZoneId(), request.getSiteId());
        if (cameraRepository.existsBySiteIdAndName(request.getSiteId(), request.getName())) {
            throw new ConflictException("Camera with name '" + request.getName()
                    + "' already exists in this site");
        }

        Camera camera = Camera.builder()
                .siteId(request.getSiteId())
                .zoneId(request.getZoneId())
                .name(request.getName())
                .rtspUrl(request.getRtspUrl())
                .calibrationJson(request.getCalibrationJson())
                .build();
        if (request.getRole() != null) {
            camera.setRole(request.getRole());
        }
        if (request.getPanelType() != null) {
            camera.setPanelType(request.getPanelType());
        }
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
        validateZone(request.getZoneId(), siteId);
        if (cameraRepository.existsBySiteIdAndName(siteId, request.getName())) {
            throw new ConflictException("Camera with name '" + request.getName()
                    + "' already exists in this site");
        }
        entitlementGuard.assertCameraCreationAllowed(siteId);

        byte[] keyBytes = new byte[32];
        SECURE_RANDOM.nextBytes(keyBytes);
        String ingestKey = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(keyBytes);
        Camera camera = Camera.builder()
                .siteId(siteId)
                .zoneId(request.getZoneId())
                .name(request.getName())
                .rtspUrl(request.getRtspUrl())
                .role(request.getRole() == null ? Camera.CameraRole.ANPR_GATE : request.getRole())
                .panelType(request.getPanelType())
                .status(Camera.CameraStatus.provisioned)
                .apiKeyHash(passwordEncoder.encode(ingestKey))
                .build();
        return new CameraWithKeyDto(cameraRepository.save(camera), ingestKey);
    }

    public CameraDto update(UUID id, CameraDto request) {
        Camera camera = findOrThrow(id);
        siteAccess.assertSiteAllowed(camera.getSiteId());
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
        if (request.getZoneId() != null) {
            validateZone(request.getZoneId(), camera.getSiteId());
            camera.setZoneId(request.getZoneId());
        }
        if (request.getRtspUrl() != null) {
            camera.setRtspUrl(request.getRtspUrl());
        }
        if (request.getRole() != null) {
            camera.setRole(request.getRole());
        }
        if (request.getPanelType() != null) {
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

    private void requireSite(UUID siteId) {
        // RLS confines this lookup to the current tenant, so a cross-tenant site
        // reads as absent — a camera can never attach to another tenant's site.
        if (!siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        siteAccess.assertSiteAllowed(siteId);
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
