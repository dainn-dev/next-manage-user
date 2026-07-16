package com.vehiclemanagement.parking;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ParkingMapSourceImageView(UUID id, UUID siteId, UUID cameraId, String contentType,
        long byteSize, String sha256, int nativeWidth, int nativeHeight, String captureMethod,
        OffsetDateTime createdAt, String readUrl) { }
