package com.vehiclemanagement.parking;

import com.vehiclemanagement.entity.Camera;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CameraRealtimePublisherTest {
    @Test
    void publishesSiteScopedCameraHealthEnvelope() {
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        CameraRealtimePublisher publisher = new CameraRealtimePublisher(messaging);
        UUID siteId = UUID.randomUUID();
        UUID cameraId = UUID.randomUUID();
        Camera camera = Camera.builder()
                .id(cameraId)
                .siteId(siteId)
                .name("Gate Cam")
                .status(Camera.CameraStatus.online)
                .build();

        publisher.publishHealthAfterCommit(camera);

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(messaging).convertAndSend(eq("/topic/site/" + siteId + "/cameras/health"), payload.capture());
        Map<?, ?> envelope = (Map<?, ?>) payload.getValue();
        assertThat(envelope.get("type")).isEqualTo("camera.health.changed");
        assertThat(envelope.get("siteId")).isEqualTo(siteId.toString());
        assertThat(envelope.get("cameraId")).isEqualTo(cameraId.toString());
        assertThat(envelope.get("status")).isEqualTo("online");
        assertThat(envelope.get("connectionState")).isEqualTo("online");
    }
}
