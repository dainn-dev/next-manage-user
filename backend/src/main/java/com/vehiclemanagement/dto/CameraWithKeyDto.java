package com.vehiclemanagement.dto;

import com.vehiclemanagement.entity.Camera;
import lombok.Getter;

@Getter
public class CameraWithKeyDto extends CameraDto {

    private final String ingestKey;

    public CameraWithKeyDto(Camera camera, String ingestKey) {
        super(camera);
        this.ingestKey = ingestKey;
    }
}
