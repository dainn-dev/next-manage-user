package com.vehiclemanagement.agent;

import com.vehiclemanagement.entity.Camera;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AgentConfigServiceTest {

    @Test
    void resolveSourcePrefersHttpSourceUrlForDroidCam() {
        Camera camera = Camera.builder()
                .id(UUID.randomUUID())
                .siteId(UUID.randomUUID())
                .name("Phone cam")
                .sourceType(Camera.SourceType.http)
                .sourceUrl("http://192.168.0.199:4747/video/force/1280x720")
                .rtspUrl(null)
                .build();

        AgentConfigService.CameraSource source = AgentConfigService.resolveSource(camera);

        assertThat(source).isNotNull();
        assertThat(source.type()).isEqualTo("http");
        assertThat(source.url()).isEqualTo("http://192.168.0.199:4747/video/force/1280x720");
    }

    @Test
    void resolveSourceFallsBackToRtspUrlAndInfersHttpScheme() {
        Camera camera = Camera.builder()
                .id(UUID.randomUUID())
                .siteId(UUID.randomUUID())
                .name("Legacy")
                .sourceType(Camera.SourceType.rtsp)
                .sourceUrl(null)
                .rtspUrl("http://192.168.0.50:4747/video")
                .build();

        AgentConfigService.CameraSource source = AgentConfigService.resolveSource(camera);

        assertThat(source.type()).isEqualTo("http");
        assertThat(source.url()).isEqualTo("http://192.168.0.50:4747/video");
    }

    @Test
    void resolveSourceReturnsNullWhenNoUrl() {
        Camera camera = Camera.builder()
                .id(UUID.randomUUID())
                .siteId(UUID.randomUUID())
                .name("Empty")
                .sourceType(Camera.SourceType.rtsp)
                .build();

        assertThat(AgentConfigService.resolveSource(camera)).isNull();
    }
}
