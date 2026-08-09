package com.vehiclemanagement.api.yolo;

import com.vehiclemanagement.api.yolo.dto.DetectRequest;
import com.vehiclemanagement.api.yolo.dto.DetectResponse;
import com.vehiclemanagement.api.yolo.dto.ExportRequest;
import com.vehiclemanagement.api.yolo.dto.ExportResponse;
import com.vehiclemanagement.service.Yolo11Service;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/yolo")
@Tag(name = "YOLOv11", description = "Vehicle detection and license plate recognition API")
@RequiredArgsConstructor
@Slf4j
public class YoloController {

    private final Yolo11Service yolo11Service;

    @PostMapping("/detect")
    @Operation(summary = "Detect vehicles in image")
    public ResponseEntity<DetectResponse> detect(
            @RequestBody DetectRequest request
    ) {
        log.info("YOLO detect request received: {}", request.getImageUrl());
        try {
            byte[] imageBytes = request.getImageBytes();
            if (imageBytes == null && request.getImageUrl() != null) {
                imageBytes = yolo11Service.downloadImage(request.getImageUrl());
            }

            if (imageBytes == null) {
                return ResponseEntity.badRequest().body(DetectResponse.error("Image data is required"));
            }

            byte[] processedImage = yolo11Service.preprocessImage(imageBytes);
            List<DetectResponse.Detection> detections = yolo11Service.detect(processedImage);

            DetectResponse response = DetectResponse.success(detections, processedImage.length);

            log.info("YOLO detect completed: {} detections", detections.size());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("YOLO detect failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(DetectResponse.error("Detection failed: " + e.getMessage()));
        }
    }

    @PostMapping("/detect-plate")
    @Operation(summary = "Detect vehicle + license plate")
    public ResponseEntity<DetectResponse> detectPlate(
            @RequestBody DetectRequest request
    ) {
        log.info("YOLO detect-plate request received");
        try {
            byte[] imageBytes = request.getImageBytes();
            if (imageBytes == null && request.getImageUrl() != null) {
                imageBytes = yolo11Service.downloadImage(request.getImageUrl());
            }

            if (imageBytes == null) {
                return ResponseEntity.badRequest().body(DetectResponse.error("Image data is required"));
            }

            byte[] processedImage = yolo11Service.preprocessImage(imageBytes);
            List<DetectResponse.Detection> detections = yolo11Service.detectWithPlate(processedImage);

            DetectResponse response = DetectResponse.success(detections, processedImage.length);

            log.info("YOLO detect-plate completed: {} objects", detections.size());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("YOLO detect-plate failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(DetectResponse.error("Detection failed: " + e.getMessage()));
        }
    }

    @PostMapping("/onnx")
    @Operation(summary = "Export model to ONNX format")
    public ResponseEntity<ExportResponse> exportOnnx(
            @RequestBody ExportRequest request
    ) {
        log.info("YOLO export ONNX request received: opset={}", request.getOpset());
        try {
            boolean success = yolo11Service.exportOnnx(request.getOpset(), request.getHalfPrecision());

            ExportResponse response = ExportResponse.builder()
                    .success(success)
                    .message(success ? "ONNX export successful" : "ONNX export failed")
                    .filename(success ? "yolo11.onnx" : null)
                    .build();

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("YOLO export ONNX failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ExportResponse.builder()
                            .success(false)
                            .message("Export failed: " + e.getMessage())
                            .build());
        }
    }

    @GetMapping("/health")
    @Operation(summary = "Health check")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("YOLOv11 API is healthy");
    }
}