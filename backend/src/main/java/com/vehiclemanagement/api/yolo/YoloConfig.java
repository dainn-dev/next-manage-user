package com.vehiclemanagement.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "yolo")
public class YoloConfig {

    private String modelPath = "models/yolo11n.pt";
    private String modelSize = "n";
    private boolean useCuda = true;
    private float confThreshold = 0.45f;
    private float iouThreshold = 0.45f;
    private int maxDet = 100;
    private String pythonServiceUrl = "http://localhost:8000/api/yolo11";

    // ONNX export settings
    private int onnxOpset = 17;
    private boolean onnxHalfPrecision = true;
}