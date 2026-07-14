package com.vehiclemanagement.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.entity.Camera;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CameraDtoSecurityTest {
    @Test
    void dashboardSerializationNeverExposesRtspSource() throws Exception {
        Camera camera = Camera.builder()
                .id(UUID.randomUUID())
                .siteId(UUID.randomUUID())
                .name("North overview")
                .rtspUrl("rtsp://camera:secret@example.internal/live")
                .streamKind(Camera.StreamKind.HLS)
                .streamUrl("https://media.example.test/camera/index.m3u8")
                .build();

        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(new CameraDto(camera));

        assertThat(json).doesNotContain("rtspUrl", "camera:secret", "example.internal");
        assertThat(json).contains("https://media.example.test/camera/index.m3u8", "HLS");
    }
}
