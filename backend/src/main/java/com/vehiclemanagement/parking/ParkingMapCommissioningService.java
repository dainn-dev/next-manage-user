package com.vehiclemanagement.parking;

import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.ParkingMapCommissioningRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ParkingMapCommissioningService {
    private final ParkingMapCommissioningRepository repository;
    private final HomographyCalibrationService calibrationService;
    private final SiteRepository siteRepository;
    private final SiteAccess siteAccess;

    public ParkingMapCommissioningService(ParkingMapCommissioningRepository repository,
            HomographyCalibrationService calibrationService, SiteRepository siteRepository, SiteAccess siteAccess) {
        this.repository = repository;
        this.calibrationService = calibrationService;
        this.siteRepository = siteRepository;
        this.siteAccess = siteAccess;
    }

    @Transactional
    public CalibrationVersionView createCalibration(UUID siteId, CreateCalibrationRequest request) {
        if (siteId == null || !siteRepository.existsById(siteId))
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        siteAccess.assertSiteAllowed(siteId);
        if (request == null || request.cameraId() == null)
            throw new IllegalArgumentException("Overview camera is required");
        if (!repository.isOverviewCameraAtSite(request.cameraId(), siteId))
            throw new IllegalArgumentException("Camera must be an OVERVIEW camera belonging to the selected site");
        HomographyCalibration calibration = calibrationService.calibrate(request.controlPoints());
        return repository.saveCalibration(siteId, request.cameraId(), calibration);
    }
}

