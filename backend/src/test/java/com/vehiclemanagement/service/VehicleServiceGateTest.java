package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleCheckResponse;
import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.repository.GateRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Covers the Phase 3.2 gate-attribution path of {@link VehicleService#checkVehicleAccess}:
 * the resolved gate is tagged onto the created log and every WebSocket event is
 * fanned out to the per-gate topic. Backward compatibility (null gateId) is also
 * asserted.
 */
@ExtendWith(MockitoExtension.class)
class VehicleServiceGateTest {

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private GateRepository gateRepository;

    @Mock
    private VehicleLogService vehicleLogService;

    @Mock
    private WebSocketService webSocketService;

    @Mock
    private SnapshotStorageService snapshotStorageService;

    @Mock
    private VehicleAccessRequestService accessRequestService;

    // Real (not mocked) registry so the Phase 4.1 timing/counter calls in
    // checkVehicleAccess work without stubbing every metric interaction.
    @Spy
    private MeterRegistry meterRegistry = new SimpleMeterRegistry();

    @InjectMocks
    private VehicleService vehicleService;

    private Vehicle approvedVehicle(String plate) {
        User owner = User.builder()
                .id(UUID.randomUUID())
                .username("nguyenvana")
                .email("nguyenvana@example.com")
                .password("pw")
                .firstName("Nguyen")
                .lastName("Van A")
                .build();
        return Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate(plate)
                .status(Vehicle.VehicleStatus.approved)
                .owner(owner)
                .build();
    }

    @Test
    void checkWithGate_tagsLogWithGateAndFansOutToPerGateTopic() {
        String plate = "76M5-1443";
        UUID gateId = UUID.randomUUID();
        Gate gate = Gate.builder().id(gateId).name("Cong chinh").location("Khu A").build();
        Vehicle vehicle = approvedVehicle(plate);
        Object monitorInfo = new Object();

        when(vehicleRepository.findByLicensePlateNormalized(plate)).thenReturn(Optional.of(vehicle));
        when(gateRepository.findById(gateId)).thenReturn(Optional.of(gate));
        when(vehicleLogService.getOwnerInfoByLicensePlate(eq(plate), any(), eq(gate)))
                .thenReturn(monitorInfo);

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry", gateId);

        assertTrue(response.isApproved());

        // The auto-generated log carries the gate id and the gate's location.
        ArgumentCaptor<VehicleLogDto> logCaptor = ArgumentCaptor.forClass(VehicleLogDto.class);
        verify(vehicleLogService).createVehicleLog(logCaptor.capture());
        assertEquals(gateId, logCaptor.getValue().getGateId());
        assertEquals("Khu A", logCaptor.getValue().getGateLocation());

        // The rich payload is fanned out to the per-gate topic (gateId passed through).
        verify(webSocketService).sendVehicleCheckMessage(monitorInfo, gateId);
    }

    @Test
    void checkWithoutGate_isBackwardCompatible() {
        String plate = "76M5-2200";
        Vehicle vehicle = approvedVehicle(plate);
        Object monitorInfo = new Object();

        when(vehicleRepository.findByLicensePlateNormalized(plate)).thenReturn(Optional.of(vehicle));
        when(vehicleLogService.getOwnerInfoByLicensePlate(eq(plate), any(), eq((Gate) null)))
                .thenReturn(monitorInfo);

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry");

        assertTrue(response.isApproved());
        verifyNoInteractions(gateRepository);

        // Log has no gate id and keeps the historical default location.
        ArgumentCaptor<VehicleLogDto> logCaptor = ArgumentCaptor.forClass(VehicleLogDto.class);
        verify(vehicleLogService).createVehicleLog(logCaptor.capture());
        assertNull(logCaptor.getValue().getGateId());
        assertEquals("Main Gate", logCaptor.getValue().getGateLocation());

        // WebSocket event goes out with a null gate id -> global topic only.
        verify(webSocketService).sendVehicleCheckMessage(monitorInfo, (UUID) null);
    }

    @Test
    void checkWithUnknownGate_doesNotFailAndLeavesLogGateless() {
        String plate = "76M5-3300";
        UUID gateId = UUID.randomUUID();
        Vehicle vehicle = approvedVehicle(plate);
        Object monitorInfo = new Object();

        when(vehicleRepository.findByLicensePlateNormalized(plate)).thenReturn(Optional.of(vehicle));
        when(gateRepository.findById(gateId)).thenReturn(Optional.empty());
        when(vehicleLogService.getOwnerInfoByLicensePlate(eq(plate), any(), eq((Gate) null)))
                .thenReturn(monitorInfo);

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry", gateId);

        assertTrue(response.isApproved());

        ArgumentCaptor<VehicleLogDto> logCaptor = ArgumentCaptor.forClass(VehicleLogDto.class);
        verify(vehicleLogService).createVehicleLog(logCaptor.capture());
        assertNull(logCaptor.getValue().getGateId());

        // Unknown gate resolves to null -> event published to the global topic only.
        verify(webSocketService).sendVehicleCheckMessage(monitorInfo, (UUID) null);
    }

    @Test
    void checkWithSnapshot_storesEvidenceAndLinksItOnTheLog() {
        String plate = "76M5-4400";
        UUID gateId = UUID.randomUUID();
        Gate gate = Gate.builder().id(gateId).name("Cong chinh").location("Khu A").build();
        Vehicle vehicle = approvedVehicle(plate);
        MultipartFile snapshot = new MockMultipartFile(
                "snapshot", "plate.jpg", "image/jpeg", new byte[]{1, 2, 3});
        String storedPath = "/uploads/snapshots/plate_76M54400_1.jpg";

        when(vehicleRepository.findByLicensePlateNormalized(plate)).thenReturn(Optional.of(vehicle));
        when(gateRepository.findById(gateId)).thenReturn(Optional.of(gate));
        when(snapshotStorageService.store(snapshot, plate)).thenReturn(storedPath);
        when(vehicleLogService.getOwnerInfoByLicensePlate(eq(plate), any(), eq(gate)))
                .thenReturn(new Object());

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry", gateId, snapshot);

        assertTrue(response.isApproved());

        // The snapshot is stored and its web path lands on the created log.
        verify(snapshotStorageService).store(snapshot, plate);
        ArgumentCaptor<VehicleLogDto> logCaptor = ArgumentCaptor.forClass(VehicleLogDto.class);
        verify(vehicleLogService).createVehicleLog(logCaptor.capture());
        assertEquals(storedPath, logCaptor.getValue().getImagePath());
    }

    @Test
    void checkUnregisteredPlate_raisesPendingRequestAndDoesNotAllow() {
        String plate = "99X-00001";
        UUID gateId = UUID.randomUUID();
        Gate gate = Gate.builder().id(gateId).name("Cong chinh").location("Khu A").build();
        String snapshotPath = "/uploads/snapshots/plate_99X00001_1.jpg";

        when(vehicleRepository.findByLicensePlateNormalized(plate)).thenReturn(Optional.empty());
        when(gateRepository.findById(gateId)).thenReturn(Optional.of(gate));
        when(snapshotStorageService.store(any(), eq(plate))).thenReturn(snapshotPath);

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry", gateId);

        // The gate must NOT open: the outcome is PENDING, not approved.
        assertFalse(response.isApproved());
        assertEquals(VehicleCheckResponse.CheckResult.PENDING, response.getResult());

        // A gate-originated access request is raised for the approval queue with the
        // captured snapshot as evidence.
        verify(accessRequestService).recordGateDetection(eq(plate), eq(gate), eq(snapshotPath), any());

        // No log is created for an unregistered plate (only approved access is logged).
        verify(vehicleLogService, never()).createVehicleLog(any());

        // The kiosk is told the outcome is pending via the explicit status flag.
        verify(webSocketService).sendVehicleCheckMessage(eq(plate), eq("entry"), any(), eq(gateId), eq("pending"));
    }

    @Test
    void checkWithoutSnapshot_leavesLogImageless() {
        String plate = "76M5-5500";
        Vehicle vehicle = approvedVehicle(plate);

        when(vehicleRepository.findByLicensePlateNormalized(plate)).thenReturn(Optional.of(vehicle));
        when(vehicleLogService.getOwnerInfoByLicensePlate(eq(plate), any(), eq((Gate) null)))
                .thenReturn(new Object());

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry");

        assertTrue(response.isApproved());
        ArgumentCaptor<VehicleLogDto> logCaptor = ArgumentCaptor.forClass(VehicleLogDto.class);
        verify(vehicleLogService).createVehicleLog(logCaptor.capture());
        assertNull(logCaptor.getValue().getImagePath());
    }
}
