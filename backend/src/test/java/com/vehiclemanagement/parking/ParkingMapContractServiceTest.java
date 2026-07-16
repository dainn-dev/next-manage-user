package com.vehiclemanagement.parking;

import com.vehiclemanagement.repository.ParkingMapContractRepository;
import com.vehiclemanagement.security.SiteAccess;
import com.vehiclemanagement.service.ObjectStorageService;
import org.junit.jupiter.api.Test;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ParkingMapContractServiceTest {
    private final ParkingMapContractRepository repo=mock(ParkingMapContractRepository.class);
    private final ObjectStorageService storage=mock(ObjectStorageService.class);
    private final SiteAccess access=mock(SiteAccess.class);
    private final ParkingMapContractService service=new ParkingMapContractService(repo,storage,new HomographyCalibrationService(),access);

    @Test
    void rejectsDesignerPolygonOutsideNativeImageBeforeCreatingDraft(){
        UUID site=UUID.randomUUID(),camera=UUID.randomUUID(),image=UUID.randomUUID(),calibration=UUID.randomUUID();
        when(repo.overviewCamera(site,camera)).thenReturn(true);
        when(repo.image(image,site,camera)).thenReturn(new ParkingMapSourceImageView(image,site,camera,"image/png",100,
                "a".repeat(64),100,80,"upload",OffsetDateTime.now(),"key"));
        when(repo.calibration(calibration,site,camera)).thenReturn(new ParkingMapContractRepository.CalibrationBinding(
                calibration,"valid",List.of(1d,0d,0d,0d,1d,0d,0d,0d,1d),image,100,80));
        when(repo.zoneAtSite(null,site)).thenReturn(true);
        when(repo.slotAtCamera(null,site,camera)).thenReturn(true);
        var slot=new ParkingMapDraftSlotRequest(null,null,"A01","enabled",List.of(
                new ParkingMapPoint(1,1),new ParkingMapPoint(101,1),new ParkingMapPoint(1,20)));

        assertThatThrownBy(()->service.create(site,camera,new ParkingMapDraftRequest(image,calibration,null,List.of(slot))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("bounds");
        verify(repo,never()).createDraft(any(),any(),any(),any(),any());
    }

    @Test
    void reportsPostGisValidationFailureWithoutPublishing(){
        UUID site=UUID.randomUUID(),camera=UUID.randomUUID(),image=UUID.randomUUID(),calibration=UUID.randomUUID(),map=UUID.randomUUID();
        when(repo.overviewCamera(site,camera)).thenReturn(true);
        var slot=new ParkingMapDraftSlotRequest(null,null,"A01","enabled",List.of(
                new ParkingMapPoint(0,0),new ParkingMapPoint(1,0),new ParkingMapPoint(0,1)));
        when(repo.get(map,site,camera)).thenReturn(new ParkingMapDraftView(map,site,camera,1,"draft",1,image,calibration,
                List.of(new ParkingMapPoint(0,0),new ParkingMapPoint(10,0),new ParkingMapPoint(0,10)),List.of(slot)));
        when(repo.image(image,site,camera)).thenReturn(new ParkingMapSourceImageView(image,site,camera,"image/png",100,
                "b".repeat(64),100,80,"upload",OffsetDateTime.now(),"key"));
        when(repo.calibration(calibration,site,camera)).thenReturn(new ParkingMapContractRepository.CalibrationBinding(
                calibration,"valid",List.of(1d,0d,0d,0d,1d,0d,0d,0d,1d),image,100,80));
        when(repo.validPolygon(anyString())).thenReturn(false);

        ParkingMapValidationView result=service.validate(site,camera,map);
        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).anyMatch(error->error.contains("invalid"));
        verify(repo,never()).publish(any(),any(),anyString(),any(),anyString());
    }
}
