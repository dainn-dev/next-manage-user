package com.vehiclemanagement.service;

import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleLog;
import com.vehiclemanagement.repository.VehicleLogRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VehicleSchedulerServiceTest {

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private VehicleLogRepository vehicleLogRepository;

    @InjectMocks
    private VehicleSchedulerService schedulerService;

    private Vehicle enteredVehicle;
    private Vehicle approvedVehicle;

    @BeforeEach
    void setUp() {
        User owner = User.builder()
                .id(UUID.randomUUID())
                .username("test-owner")
                .email("owner@example.com")
                .password("pw")
                .build();

        enteredVehicle = Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate("51A-12345")
                .vehicleType(Vehicle.VehicleType.car)
                .status(Vehicle.VehicleStatus.entered)
                .registrationDate(LocalDate.now())
                .owner(owner)
                .build();

        approvedVehicle = Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate("51B-67890")
                .vehicleType(Vehicle.VehicleType.motorbike)
                .status(Vehicle.VehicleStatus.approved)
                .registrationDate(LocalDate.now())
                .owner(owner)
                .build();
    }

    @Test
    void resetEnteredVehicleStatuses_setsEnteredVehiclesToExited() {
        when(vehicleRepository.findByStatus(Vehicle.VehicleStatus.entered))
                .thenReturn(List.of(enteredVehicle));

        schedulerService.resetEnteredVehicleStatuses();

        assertEquals(Vehicle.VehicleStatus.exited, enteredVehicle.getStatus());
        verify(vehicleRepository).saveAll(List.of(enteredVehicle));
    }

    @Test
    void resetEnteredVehicleStatuses_createsAuditLogForEachEnteredVehicle() {
        when(vehicleRepository.findByStatus(Vehicle.VehicleStatus.entered))
                .thenReturn(List.of(enteredVehicle));

        schedulerService.resetEnteredVehicleStatuses();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<VehicleLog>> logCaptor = ArgumentCaptor.forClass(List.class);
        verify(vehicleLogRepository).saveAll(logCaptor.capture());

        List<VehicleLog> savedLogs = logCaptor.getValue();
        assertEquals(1, savedLogs.size());

        VehicleLog log = savedLogs.get(0);
        assertEquals("51A-12345", log.getLicensePlateNumber());
        assertEquals(VehicleLog.LogType.exit, log.getType());
        assertEquals(VehicleLog.VehicleCategory.internal, log.getVehicleType());
        assertTrue(log.getNotes().contains("Auto end-of-day reset by scheduler"));
    }

    @Test
    void resetEnteredVehicleStatuses_doesNotTouchApprovedVehicles() {
        when(vehicleRepository.findByStatus(Vehicle.VehicleStatus.entered))
                .thenReturn(Collections.emptyList());

        schedulerService.resetEnteredVehicleStatuses();

        assertEquals(Vehicle.VehicleStatus.approved, approvedVehicle.getStatus());
        verify(vehicleRepository, never()).saveAll(anyList());
        verify(vehicleLogRepository, never()).saveAll(anyList());
    }

    @Test
    void resetEnteredVehicleStatuses_noEnteredVehicles_doesNothing() {
        when(vehicleRepository.findByStatus(Vehicle.VehicleStatus.entered))
                .thenReturn(Collections.emptyList());

        schedulerService.resetEnteredVehicleStatuses();

        verify(vehicleRepository, never()).saveAll(anyList());
        verify(vehicleLogRepository, never()).saveAll(anyList());
    }
}
