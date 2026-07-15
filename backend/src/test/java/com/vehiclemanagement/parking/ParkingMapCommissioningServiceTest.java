package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.ParkingMapCommissioningRepository;
import com.vehiclemanagement.repository.SiteRepository;
import com.vehiclemanagement.security.SiteAccess;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ParkingMapCommissioningServiceTest {
    @Test
    void rejectsCameraFromAnotherSiteBeforePersistingCalibration() {
        ParkingMapCommissioningRepository repository = mock(ParkingMapCommissioningRepository.class);
        SiteRepository sites = mock(SiteRepository.class);
        SiteAccess access = mock(SiteAccess.class);
        UUID siteId = UUID.randomUUID();
        UUID cameraId = UUID.randomUUID();
        when(sites.existsById(siteId)).thenReturn(true);
        when(repository.isOverviewCameraAtSite(cameraId, siteId)).thenReturn(false);
        ParkingMapCommissioningService service = new ParkingMapCommissioningService(
                repository, new HomographyCalibrationService(), sites, access);

        assertThatThrownBy(() -> service.createCalibration(siteId,
                new CreateCalibrationRequest(cameraId, List.of())))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("OVERVIEW");
        verify(access).assertSiteAllowed(siteId);
    }
}
