package com.vehiclemanagement.service;

import com.vehiclemanagement.entity.Camera;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CameraServiceTest {

    @Test
    void overviewCameraIsSiteScopedEvenWhenClientSendsZoneAndPanel() {
        UUID requestedZoneId = UUID.randomUUID();

        assertThat(CameraService.zoneForRole(Camera.CameraRole.OVERVIEW, requestedZoneId)).isNull();
        assertThat(CameraService.panelForRole(Camera.CameraRole.OVERVIEW, Camera.PanelType.entry)).isNull();
    }

    @Test
    void gateCameraKeepsItsZoneAndPanel() {
        UUID requestedZoneId = UUID.randomUUID();

        assertThat(CameraService.zoneForRole(Camera.CameraRole.ANPR_GATE, requestedZoneId))
                .isEqualTo(requestedZoneId);
        assertThat(CameraService.panelForRole(Camera.CameraRole.ANPR_GATE, Camera.PanelType.exit))
                .isEqualTo(Camera.PanelType.exit);
    }
}
