package com.vehiclemanagement.controller;

import com.vehiclemanagement.parking.ParkingMapCommissioningService;
import com.vehiclemanagement.parking.ParkingMapContractService;
import com.vehiclemanagement.parking.ParkingMapDraftView;
import com.vehiclemanagement.parking.ParkingMapService;
import com.vehiclemanagement.parking.SlotOccupancyService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ParkingMapContractControllerTest {

    @Test
    void publishPassesIfMatchLockAndReturnsTheUpdatedEtag() {
        ParkingMapContractService service = mock(ParkingMapContractService.class);
        ParkingMapContractController controller = new ParkingMapContractController(
                service, mock(ParkingMapCommissioningService.class));
        UUID siteId = UUID.randomUUID();
        UUID cameraId = UUID.randomUUID();
        UUID mapId = UUID.randomUUID();
        ParkingMapDraftView published = new ParkingMapDraftView(mapId, siteId, cameraId, 3,
                "published", 8, UUID.randomUUID(), UUID.randomUUID(), List.of(), List.of());
        when(service.publish(siteId, cameraId, mapId, 7, "publish-3")).thenReturn(published);

        var response = controller.publish(siteId, cameraId, mapId, "W/\"" + mapId + ":7\"", "publish-3");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getETag()).isEqualTo("\"" + mapId + ":8\"");
        assertThat(response.getBody()).isSameAs(published);
        verify(service).publish(siteId, cameraId, mapId, 7, "publish-3");
    }

    @Test
    void legacyDirectReplaceWriterIsPermanentlyGone() {
        ParkingMapService legacyService = mock(ParkingMapService.class);
        ParkingSlotController controller = new ParkingSlotController(
                legacyService, mock(SlotOccupancyService.class));

        var response = controller.replace(UUID.randomUUID(), List.of());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        verifyNoInteractions(legacyService);
    }
}
