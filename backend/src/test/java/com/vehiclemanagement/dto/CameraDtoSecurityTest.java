package com.vehiclemanagement.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclemanagement.entity.Camera;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CameraDtoSecurityTest {
    @Test
    void dashboardSerializationExposesRtspSourceForOperatorsButNeverCredentialHashes() throws Exception {
        Camera camera = Camera.builder()
                .id(UUID.randomUUID())
                .siteId(UUID.randomUUID())
                .name("North overview")
                .sourceType(Camera.SourceType.rtsp)
                .sourceUrl("rtsp://camera:secret@example.internal/live")
                .rtspUrl("rtsp://camera:secret@example.internal/live")
                .apiKeyHash("$2a$10$not-a-real-hash")
                .previousApiKeyHash("$2a$10$also-not-real")
                .streamKind(Camera.StreamKind.HLS)
                .streamUrl("https://media.example.test/camera/index.m3u8")
                .build();

        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(new CameraDto(camera));

        assertThat(json).contains(
                "rtspUrl",
                "sourceType",
                "sourceUrl",
                "rtsp://camera:secret@example.internal/live",
                "https://media.example.test/camera/index.m3u8",
                "HLS");
        assertThat(json).doesNotContain("apiKeyHash", "previousApiKeyHash", "$2a$10$");
    }
}
