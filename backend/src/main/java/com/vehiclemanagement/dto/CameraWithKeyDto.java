package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class CameraWithKeyDto extends CameraDto {

    private final String ingestKey;
    private final LocalDateTime previousKeyExpiresAt;

    public CameraWithKeyDto(Camera camera, String ingestKey) {
        this(camera, ingestKey, null);
    }

    public CameraWithKeyDto(Camera camera, String ingestKey, LocalDateTime previousKeyExpiresAt) {
        super(camera);
        this.ingestKey = ingestKey;
        this.previousKeyExpiresAt = previousKeyExpiresAt;
    }
}
