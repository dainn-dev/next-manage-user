package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleLogDto;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.EmployeeRepository;
import com.vehiclemanagement.repository.GateRepository;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VehicleLogServiceGateTest {

    @Mock
    private VehicleLogRepository vehicleLogRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private GateRepository gateRepository;

    @InjectMocks
    private VehicleLogService vehicleLogService;

    @Test
    void createVehicleLog_withGateId_associatesGateAndDefaultsLocation() {
        UUID gateId = UUID.randomUUID();
        Gate gate = Gate.builder().id(gateId).name("Cong chinh").location("Khu A").build();

        VehicleLogDto dto = VehicleLogDto.builder()
                .licensePlateNumber("76M5-1443")
                .entryExitTime(LocalDateTime.now())
                .type(VehicleLog.LogType.entry)
                .vehicleType(VehicleLog.VehicleCategory.internal)
                .gateId(gateId)
                .build();

        when(vehicleRepository.findByLicensePlateNormalized(any())).thenReturn(Optional.empty());
        when(gateRepository.findById(gateId)).thenReturn(Optional.of(gate));
        when(vehicleLogRepository.save(any(VehicleLog.class))).thenAnswer(inv -> inv.getArgument(0));

        VehicleLogDto result = vehicleLogService.createVehicleLog(dto);

        ArgumentCaptor<VehicleLog> saved = ArgumentCaptor.forClass(VehicleLog.class);
        verify(vehicleLogRepository).save(saved.capture());
        assertNotNull(saved.getValue().getGate());
        assertEquals(gateId, saved.getValue().getGate().getId());
        // gateLocation was empty on the DTO -> defaulted from the gate's location.
        assertEquals("Khu A", saved.getValue().getGateLocation());

        assertEquals(gateId, result.getGateId());
        assertEquals("Cong chinh", result.getGateName());
    }

    @Test
    void createVehicleLog_withUnknownGateId_savesGateless() {
        UUID gateId = UUID.randomUUID();
        VehicleLogDto dto = VehicleLogDto.builder()
                .licensePlateNumber("76M5-2200")
                .entryExitTime(LocalDateTime.now())
                .type(VehicleLog.LogType.exit)
                .vehicleType(VehicleLog.VehicleCategory.internal)
                .gateId(gateId)
                .build();

        when(vehicleRepository.findByLicensePlateNormalized(any())).thenReturn(Optional.empty());
        when(gateRepository.findById(gateId)).thenReturn(Optional.empty());
        when(vehicleLogRepository.save(any(VehicleLog.class))).thenAnswer(inv -> inv.getArgument(0));

        VehicleLogDto result = vehicleLogService.createVehicleLog(dto);

        ArgumentCaptor<VehicleLog> saved = ArgumentCaptor.forClass(VehicleLog.class);
        verify(vehicleLogRepository).save(saved.capture());
        assertNull(saved.getValue().getGate());
        assertNull(result.getGateId());
    }

    @Test
    void getRecentChecksByGate_nullSince_defaultsToStartOfToday() {
        UUID gateId = UUID.randomUUID();
        Gate gate = Gate.builder().id(gateId).name("Cong chinh").build();
        VehicleLog log = VehicleLog.builder()
                .id(UUID.randomUUID())
                .licensePlateNumber("76M5-1443")
                .entryExitTime(LocalDateTime.now())
                .type(VehicleLog.LogType.entry)
                .vehicleType(VehicleLog.VehicleCategory.internal)
                .gate(gate)
                .build();

        when(vehicleLogRepository.findByGateSince(eq(gateId), any(LocalDateTime.class)))
                .thenReturn(List.of(log));

        List<VehicleLogDto> result = vehicleLogService.getRecentChecksByGate(gateId, null);

        assertEquals(1, result.size());
        assertEquals(gateId, result.get(0).getGateId());

        ArgumentCaptor<LocalDateTime> sinceCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(vehicleLogRepository).findByGateSince(eq(gateId), sinceCaptor.capture());
        assertEquals(LocalDate.now().atStartOfDay(), sinceCaptor.getValue());
    }

    @Test
    void getRecentChecksByGate_explicitSince_isPassedThrough() {
        UUID gateId = UUID.randomUUID();
        LocalDateTime since = LocalDateTime.now().minusHours(2);
        when(vehicleLogRepository.findByGateSince(gateId, since)).thenReturn(List.of());

        List<VehicleLogDto> result = vehicleLogService.getRecentChecksByGate(gateId, since);

        assertTrue(result.isEmpty());
        verify(vehicleLogRepository).findByGateSince(gateId, since);
    }
}
