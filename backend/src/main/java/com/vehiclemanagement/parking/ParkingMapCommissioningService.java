package com.vehiclemanagement.parking;

import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.ParkingMapCommissioningRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.List;

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
        if (!repository.sourceImageAtCamera(request.sourceImageId(), siteId, request.cameraId()))
            throw new IllegalArgumentException("Calibration source image must belong to the selected OVERVIEW camera");
        HomographyCalibration calibration = calibrationService.calibrate(request.controlPoints());
        return repository.saveCalibration(siteId, request.cameraId(), request.sourceImageId(), calibration);
    }

    @Transactional(readOnly = true)
    public HomographyCalibration validateCalibration(UUID siteId, CreateCalibrationRequest request) {
        if (siteId == null || !siteRepository.existsById(siteId)) throw new ResourceNotFoundException("Site not found with id: " + siteId);
        siteAccess.assertSiteAllowed(siteId);
        if (request == null || request.cameraId() == null || !repository.isOverviewCameraAtSite(request.cameraId(), siteId))
            throw new IllegalArgumentException("Camera must be an OVERVIEW camera belonging to the selected site");
        if (!repository.sourceImageAtCamera(request.sourceImageId(), siteId, request.cameraId()))
            throw new IllegalArgumentException("Calibration source image must belong to the selected OVERVIEW camera");
        return calibrationService.calibrate(request.controlPoints());
    }

    @Transactional(readOnly = true)
    public List<CalibrationVersionView> listCalibrations(UUID siteId, UUID cameraId) {
        requireOverview(siteId, cameraId);
        return repository.calibrations(siteId, cameraId);
    }

    @Transactional(readOnly = true)
    public CalibrationVersionView getCalibration(UUID siteId, UUID cameraId, UUID calibrationId) {
        requireOverview(siteId, cameraId);
        return repository.calibration(calibrationId, siteId, cameraId);
    }

    @Transactional
    public void invalidateCalibration(UUID siteId, UUID cameraId, UUID calibrationId) {
        requireOverview(siteId, cameraId);
        repository.invalidateCalibration(calibrationId, siteId, cameraId);
    }

    private void requireOverview(UUID siteId, UUID cameraId) {
        if (siteId == null || !siteRepository.existsById(siteId))
            throw new ResourceNotFoundException("Site not found with id: " + siteId);
        siteAccess.assertSiteAllowed(siteId);
        if (cameraId == null || !repository.isOverviewCameraAtSite(cameraId, siteId))
            throw new ResourceNotFoundException("Overview camera not found");
    }
}
