package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleCheckResponse;
import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.repository.GateRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

    @InjectMocks
    private VehicleService vehicleService;

    private Vehicle approvedVehicle(String plate) {
        Employee employee = Employee.builder()
                .id(UUID.randomUUID())
                .employeeId("E001")
                .name("Nguyen Van A")
                .build();
        return Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate(plate)
                .status(Vehicle.VehicleStatus.approved)
                .employee(employee)
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
        when(vehicleLogService.getEmployeeInfoByLicensePlate(eq(plate), any(), eq(gate)))
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
        when(vehicleLogService.getEmployeeInfoByLicensePlate(eq(plate), any(), eq((Gate) null)))
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
        when(vehicleLogService.getEmployeeInfoByLicensePlate(eq(plate), any(), eq((Gate) null)))
                .thenReturn(monitorInfo);

        VehicleCheckResponse response = vehicleService.checkVehicleAccess(plate, "entry", gateId);

        assertTrue(response.isApproved());

        ArgumentCaptor<VehicleLogDto> logCaptor = ArgumentCaptor.forClass(VehicleLogDto.class);
        verify(vehicleLogService).createVehicleLog(logCaptor.capture());
        assertNull(logCaptor.getValue().getGateId());

        // Unknown gate resolves to null -> event published to the global topic only.
        verify(webSocketService).sendVehicleCheckMessage(monitorInfo, (UUID) null);
    }
}
