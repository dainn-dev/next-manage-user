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
@Schema(description = "Request for ONNX export")
public class ExportRequest {

    @Schema(description = "ONNX opset version", example = "17", defaultValue = "17")
    private Integer opset = 17;

    @Schema(description = "Use half precision (FP16)", example = "true", defaultValue = "true")
    private Boolean halfPrecision = true;
}