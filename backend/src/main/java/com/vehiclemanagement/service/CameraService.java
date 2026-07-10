package com.vehiclemanagement.service;

import com.vehiclemanagement.billing.EntitlementGuard;
import com.vehiclemanagement.dto.CameraCreateRequest;
import com.vehiclemanagement.dto.CameraDto;
import com.vehiclemanagement.dto.CameraWithKeyDto;
import com.vehiclemanagement.entity.Camera;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.CameraRepository;
import com.vehiclemanagement.repository.SiteRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class CameraService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final CameraRepository cameraRepository;
    private final SiteRepository siteRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntitlementGuard entitlementGuard;

    public CameraService(CameraRepository cameraRepository,
                         SiteRepository siteRepository,
                         PasswordEncoder passwordEncoder,
                         EntitlementGuard entitlementGuard) {
        this.cameraRepository = cameraRepository;
        this.siteRepository = siteRepository;
        this.passwordEncoder = passwordEncoder;
        this.entitlementGuard = entitlementGuard;
    }

    @Transactional(readOnly = true)
    public List<CameraDto> listBySite(UUID siteId) {
        if (!siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        return cameraRepository.findBySiteId(siteId).stream()
                .map(CameraDto::new)
                .toList();
    }

    public CameraWithKeyDto create(UUID siteId, CameraCreateRequest request) {
        if (!siteRepository.existsById(siteId)) {
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        }
        if (cameraRepository.existsBySiteIdAndName(siteId, request.getName())) {
            throw new IllegalArgumentException("Camera with name '" + request.getName() + "' already exists for this site");
        }

        entitlementGuard.assertCameraCreationAllowed(siteId);

        String ingestKey = generateIngestKey();
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

    private String generateIngestKey() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
