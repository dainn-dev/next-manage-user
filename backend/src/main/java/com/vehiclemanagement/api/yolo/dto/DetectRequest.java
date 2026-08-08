package com.vehiclemanagement.api.yolo.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Request body for YOLO detection")
public class DetectRequest {

    @Schema(description = "Base64 encoded image", example = "data:image/jpeg;base64,/9j/4AAQSkZJRg...")
    private String imageBase64;

    @Schema(description = "Image URL (optional)", example = "https://example.com/car.jpg")
    private String imageUrl;

    @Schema(description = "Confidence threshold (0-1)", example = "0.45", defaultValue = "0.45")
    private Double confThreshold = 0.45;

    @Schema(description = "IOU threshold", example = "0.45", defaultValue = "0.45")
    private Double iouThreshold = 0.45;
}