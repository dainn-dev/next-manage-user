package com.vehiclemanagement.service;

import com.vehiclemanagement.api.yolo.dto.DetectResponse;
import com.vehiclemanagement.config.YoloConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class Yolo11Service {

    private final YoloConfig yoloConfig;
    private final RestTemplate restTemplate;

    public List<DetectResponse.Detection> detect(byte[] imageBytes) {
        log.info("Running YOLOv11 detect (placeholder - integrate with Python service)");
        return List.of(
            DetectResponse.Detection.builder()
                .classId(2)
                .className("car")
                .confidence(0.92)
                .bbox(List.of(120, 80, 420, 280))
                .area(45200)
                .build(),
            DetectResponse.Detection.builder()
                .classId(7)
                .className("truck")
                .confidence(0.78)
                .bbox(List.of(180, 100, 380, 320))
                .area(51200)
                .build()
        );
    }

    public List<DetectResponse.Detection> detectWithPlate(byte[] imageBytes) {
        List<DetectResponse.Detection> detections = detect(imageBytes);

        if (!detections.isEmpty()) {
            detections.get(0).setPlateText("ABC 1234");
            detections.get(0).setPlateConfidence(0.85);
        }

        return detections;
    }

    public boolean exportOnnx(int opset, boolean halfPrecision) {
        log.info("Exporting YOLOv11 to ONNX (opset={}, half={})", opset, halfPrecision);
        // TODO: Integrate with Python service
        return true;
    }
}