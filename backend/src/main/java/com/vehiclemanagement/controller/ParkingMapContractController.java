package com.vehiclemanagement.controller;

import com.vehiclemanagement.exception.ConflictException;
import com.vehiclemanagement.parking.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/sites/{siteId}/cameras/{cameraId}")
@PreAuthorize("hasAnyRole('TENANT_ADMIN','SITE_MANAGER')")
public class ParkingMapContractController {
        private final ParkingMapContractService service;
        private final ParkingMapCommissioningService calibrationService;

        public ParkingMapContractController(ParkingMapContractService service,
                        ParkingMapCommissioningService calibrationService) {
                this.service = service;
                this.calibrationService = calibrationService;
        }

        @PostMapping(value = "/stills:upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public ResponseEntity<ParkingMapSourceImageView> upload(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @RequestPart("file") MultipartFile file) {
                return ResponseEntity.status(HttpStatus.CREATED).body(service.upload(siteId, cameraId, file));
        }

        @PostMapping("/stills:capture")
        public ResponseEntity<Void> capture(@PathVariable UUID siteId, @PathVariable UUID cameraId) {
                throw new ConflictException("capture_unavailable: upload a still for this deployment");
        }

        @GetMapping("/stills")
        public List<ParkingMapSourceImageView> images(@PathVariable UUID siteId, @PathVariable UUID cameraId) {
                return service.images(siteId, cameraId);
        }

        @GetMapping("/stills/{stillId}")
        public ParkingMapSourceImageView image(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID stillId) {
                return service.image(siteId, cameraId, stillId);
        }

        @PostMapping("/calibrations:validate")
        public HomographyCalibration validateCalibration(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @RequestBody CreateCalibrationRequest request) {
                return calibrationService.validateCalibration(siteId, new CreateCalibrationRequest(cameraId,
                                request.sourceImageId(), request.controlPoints()));
        }

        @PostMapping("/calibrations")
        public ResponseEntity<CalibrationVersionView> createCalibration(@PathVariable UUID siteId,
                        @PathVariable UUID cameraId,
                        @RequestBody CreateCalibrationRequest request) {
                return ResponseEntity.status(HttpStatus.CREATED).body(
                                calibrationService.createCalibration(siteId, new CreateCalibrationRequest(cameraId,
                                                request.sourceImageId(), request.controlPoints())));
        }

        @GetMapping("/calibrations")
        public List<CalibrationVersionView> calibrations(@PathVariable UUID siteId, @PathVariable UUID cameraId) {
                return calibrationService.listCalibrations(siteId, cameraId);
        }

        @GetMapping("/calibrations/{calibrationId}")
        public CalibrationVersionView calibration(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID calibrationId) {
                return calibrationService.getCalibration(siteId, cameraId, calibrationId);
        }

        @PostMapping("/calibrations/{calibrationId}:invalidate")
        public ResponseEntity<Void> invalidateCalibration(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID calibrationId) {
                calibrationService.invalidateCalibration(siteId, cameraId, calibrationId);
                return ResponseEntity.noContent().build();
        }

        @PostMapping("/maps")
        public ResponseEntity<ParkingMapDraftView> create(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @RequestBody ParkingMapDraftRequest request) {
                var body = service.create(siteId, cameraId, request);
                return ResponseEntity.status(HttpStatus.CREATED).eTag(etag(body)).body(body);
        }

        @GetMapping("/maps")
        public List<ParkingMapDraftView> list(@PathVariable UUID siteId, @PathVariable UUID cameraId) {
                return service.list(siteId, cameraId);
        }

        @PostMapping("/maps:import")
        public ResponseEntity<ParkingMapDraftView> importGeoJson(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @RequestBody ParkingMapGeoJsonImportRequest request) {
                var body = service.importGeoJson(siteId, cameraId, request);
                return ResponseEntity.status(HttpStatus.CREATED).eTag(etag(body)).body(body);
        }

        @GetMapping("/maps/{mapId}")
        public ResponseEntity<ParkingMapDraftView> get(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId) {
                var body = service.get(siteId, cameraId, mapId);
                return ResponseEntity.ok().eTag(etag(body)).body(body);
        }

        @PutMapping("/maps/{mapId}")
        public ResponseEntity<ParkingMapDraftView> update(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId, @RequestHeader("If-Match") String ifMatch,
                        @RequestBody ParkingMapDraftRequest request) {
                var body = service.update(siteId, cameraId, mapId, lock(ifMatch), request);
                return ResponseEntity.ok().eTag(etag(body)).body(body);
        }

        @DeleteMapping("/maps/{mapId}")
        public ResponseEntity<Void> delete(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId,
                        @RequestHeader("If-Match") String ifMatch) {
                service.delete(siteId, cameraId, mapId, lock(ifMatch));
                return ResponseEntity.noContent().build();
        }

        @PostMapping("/maps/{mapId}:validate")
        public ParkingMapValidationView validate(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId) {
                return service.validate(siteId, cameraId, mapId);
        }

        @PostMapping("/maps/{mapId}:publish")
        public ResponseEntity<ParkingMapDraftView> publish(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId, @RequestHeader("If-Match") String ifMatch,
                        @RequestHeader("Idempotency-Key") String key) {
                var body = service.publish(siteId, cameraId, mapId, lock(ifMatch), key);
                return ResponseEntity.ok().eTag(etag(body)).body(body);
        }

        @PostMapping("/maps/{mapId}:archive")
        public ResponseEntity<Void> archive(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId,
                        @RequestHeader("If-Match") String ifMatch) {
                service.archive(siteId, cameraId, mapId, lock(ifMatch));
                return ResponseEntity.noContent().build();
        }

        @PostMapping("/maps/{mapId}:rollback")
        public ResponseEntity<ParkingMapDraftView> rollback(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId, @RequestHeader("If-Match") String ifMatch,
                        @RequestBody ParkingMapRollbackRequest request) {
                var body = service.rollback(siteId, cameraId, mapId, lock(ifMatch),
                                request == null ? null : request.reason());
                return ResponseEntity.ok().eTag(etag(body)).body(body);
        }

        @GetMapping(value = "/maps/{mapId}/export", produces = "application/geo+json")
        public Map<String, Object> exportGeoJson(@PathVariable UUID siteId, @PathVariable UUID cameraId,
                        @PathVariable UUID mapId) {
                return service.exportGeoJson(siteId, cameraId, mapId);
        }

        private String etag(ParkingMapDraftView view) {
                return "\"" + view.id() + ":" + view.lockVersion() + "\"";
        }

        private int lock(String value) {
                try {
                        String v = value.trim();
                        if (v.startsWith("W/"))
                                v = v.substring(2);
                        v = v.replace("\"", "");
                        int colon = v.lastIndexOf(':');
                        return Integer.parseInt(colon >= 0 ? v.substring(colon + 1) : v);
                } catch (Exception e) {
                        throw new IllegalArgumentException("If-Match must contain the draft lock version");
                }
        }
}
