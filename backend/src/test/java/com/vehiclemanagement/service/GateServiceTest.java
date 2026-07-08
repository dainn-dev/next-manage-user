package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.GateDto;
import com.vehiclemanagement.dto.GateRegisterRequest;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.GateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GateServiceTest {

    @Mock
    private GateRepository gateRepository;

    @InjectMocks
    private GateService gateService;

    @Test
    void register_newGateByName_createsGateAndMarksOnline() {
        GateRegisterRequest request = GateRegisterRequest.builder()
                .name("Cổng chính")
                .location("Khu A")
                .cameraRtspUrl("rtsp://cam/1")
                .build();

        when(gateRepository.findByName("Cổng chính")).thenReturn(Optional.empty());
        when(gateRepository.save(any(Gate.class))).thenAnswer(inv -> inv.getArgument(0));

        GateDto result = gateService.register(request);

        assertEquals("Cổng chính", result.getName());
        assertEquals("Khu A", result.getLocation());
        assertEquals("rtsp://cam/1", result.getCameraRtspUrl());
        assertEquals(Gate.GateStatus.online, result.getStatus());
        assertNotNull(result.getLastHeartbeatAt());
        verify(gateRepository).save(any(Gate.class));
    }

    @Test
    void register_existingGateByName_updatesInPlace() {
        Gate existing = Gate.builder()
                .id(UUID.randomUUID())
                .name("Cổng chính")
                .status(Gate.GateStatus.offline)
                .build();

        GateRegisterRequest request = GateRegisterRequest.builder()
                .name("Cổng chính")
                .location("Khu B")
                .build();

        when(gateRepository.findByName("Cổng chính")).thenReturn(Optional.of(existing));
        when(gateRepository.save(any(Gate.class))).thenAnswer(inv -> inv.getArgument(0));

        GateDto result = gateService.register(request);

        assertEquals(existing.getId(), result.getId());
        assertEquals("Khu B", result.getLocation());
        assertEquals(Gate.GateStatus.online, result.getStatus());
    }

    @Test
    void register_disabledGate_isNotForcedOnline() {
        Gate disabled = Gate.builder()
                .id(UUID.randomUUID())
                .name("Cổng phụ")
                .status(Gate.GateStatus.disabled)
                .build();

        GateRegisterRequest request = GateRegisterRequest.builder().name("Cổng phụ").build();

        when(gateRepository.findByName("Cổng phụ")).thenReturn(Optional.of(disabled));
        when(gateRepository.save(any(Gate.class))).thenAnswer(inv -> inv.getArgument(0));

        GateDto result = gateService.register(request);

        assertEquals(Gate.GateStatus.disabled, result.getStatus());
    }

    @Test
    void heartbeat_updatesTimestampAndMarksOnline() {
        UUID id = UUID.randomUUID();
        Gate gate = Gate.builder()
                .id(id)
                .name("Cổng chính")
                .status(Gate.GateStatus.offline)
                .lastHeartbeatAt(LocalDateTime.now().minusMinutes(10))
                .build();

        when(gateRepository.findById(id)).thenReturn(Optional.of(gate));
        when(gateRepository.save(any(Gate.class))).thenAnswer(inv -> inv.getArgument(0));

        GateDto result = gateService.heartbeat(id);

        assertEquals(Gate.GateStatus.online, result.getStatus());
        assertTrue(result.getLastHeartbeatAt().isAfter(LocalDateTime.now().minusSeconds(5)));
    }

    @Test
    void heartbeat_disabledGate_staysDisabled() {
        UUID id = UUID.randomUUID();
        Gate gate = Gate.builder()
                .id(id)
                .name("Cổng chính")
                .status(Gate.GateStatus.disabled)
                .build();

        when(gateRepository.findById(id)).thenReturn(Optional.of(gate));
        when(gateRepository.save(any(Gate.class))).thenAnswer(inv -> inv.getArgument(0));

        GateDto result = gateService.heartbeat(id);

        assertEquals(Gate.GateStatus.disabled, result.getStatus());
        assertNotNull(result.getLastHeartbeatAt());
    }

    @Test
    void heartbeat_unknownGate_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(gateRepository.findById(id)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> gateService.heartbeat(id));
        verify(gateRepository, never()).save(any());
    }
}
