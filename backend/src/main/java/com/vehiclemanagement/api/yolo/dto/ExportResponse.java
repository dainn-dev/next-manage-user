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
@Schema(description = "Response for ONNX export")
public class ExportResponse {

    @Schema(description = "Whether export was successful")
    private boolean success;

    @Schema(description = "Error message if failed")
    private String message;

    @Schema(description = "Generated filename", example = "yolo11.onnx")
    private String filename;

    @Schema(description = "File size in bytes")
    private Long fileSize;

    @Schema(description = "Export time in ms")
    private Long exportTime;
}