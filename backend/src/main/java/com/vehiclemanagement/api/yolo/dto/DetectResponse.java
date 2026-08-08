package com.vehiclemanagement.api.yolo.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Response for YOLO detection")
public class DetectResponse {

    @Schema(description = "Whether request was successful")
    private boolean success;

    @Schema(description = "Error message if failed")
    private String error;

    @Schema(description = "Detections results")
    private List<Detection> detections;

    @Schema(description = "Image size in bytes")
    private Integer imageSize;

    @Schema(description = "Inference time in ms")
    private Long inferenceTime;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Single detection result")
    public static class Detection {
        @Schema(description = "Class ID", example = "3")
        private Integer classId;

        @Schema(description = "Class name", example = "car")
        private String className;

        @Schema(description = "Confidence score (0-1)", example = "0.92")
        private Double confidence;

        @Schema(description = "Bounding box [x1, y1, x2, y2]", example = "[120, 80, 420, 280]")
        private List<Integer> bbox;

        @Schema(description = "Detection area", example = "45200")
        private Integer area;

        @Schema(description = "License plate text (if applicable)", example = "ABC 1234")
        private String plateText;

        @Schema(description = "License plate confidence", example = "0.85")
        private Double plateConfidence;
    }

    public static DetectResponse success(List<Detection> detections, Integer imageSize) {
        return DetectResponse.builder()
                .success(true)
                .detections(detections)
                .imageSize(imageSize)
                .inferenceTime(System.currentTimeMillis())
                .build();
    }

    public static DetectResponse error(String message) {
        return DetectResponse.builder()
                .success(false)
                .error(message)
                .build();
    }
}