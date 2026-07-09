package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleAccessRequestDto;
import com.vehiclemanagement.entity.Employee;
import com.vehiclemanagement.entity.Gate;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleAccessRequest;
import com.vehiclemanagement.entity.VehicleAccessRequest.AccessRequestStatus;
import com.vehiclemanagement.entity.VehicleAccessRequest.RequestSource;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleAccessRequestRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VehicleAccessRequestServiceTest {

    @Mock
    private VehicleAccessRequestRepository requestRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private VehicleAccessRequestService service;

    private Vehicle vehicle;
    private User requester;
    private User approver;

    @BeforeEach
    void setUp() {
        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setName("Test Employee");

        vehicle = Vehicle.builder()
                .id(UUID.randomUUID())
                .licensePlate("51A-99999")
                .vehicleType(Vehicle.VehicleType.car)
                .status(Vehicle.VehicleStatus.rejected)
                .registrationDate(LocalDate.now())
                .employee(employee)
                .build();

        requester = User.builder()
                .id(UUID.randomUUID())
                .username("user1")
                .email("user1@test.com")
                .password("pw")
                .role(User.Role.MEMBER)
                .build();

        approver = User.builder()
                .id(UUID.randomUUID())
                .username("approver1")
                .email("approver1@test.com")
                .password("pw")
                .role(User.Role.SITE_MANAGER)
                .build();
    }

    // --- createRequest ---

    @Test
    void createRequest_returnsPendingRequest() {
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(userRepository.findById(requester.getId())).thenReturn(Optional.of(requester));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleAccessRequestDto result = service.createRequest(
                vehicle.getId(), requester.getId(), "Need access", null, null);

        assertEquals(AccessRequestStatus.PENDING, result.getStatus());
        assertEquals("Need access", result.getRequestReason());
        verify(requestRepository).save(any());
    }

    @Test
    void createRequest_throwsWhenVehicleNotFound() {
        UUID missingId = UUID.randomUUID();
        when(vehicleRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.createRequest(missingId, requester.getId(), "reason", null, null));
    }

    @Test
    void createRequest_throwsWhenUserNotFound() {
        UUID missingId = UUID.randomUUID();
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.createRequest(vehicle.getId(), missingId, "reason", null, null));
    }

    // --- approveRequest ---

    @Test
    void approveRequest_setsApprovedAndUpdatesVehicle() {
        VehicleAccessRequest request = buildPendingRequest();
        when(requestRepository.findById(request.getId())).thenReturn(Optional.of(request));
        when(userRepository.findById(approver.getId())).thenReturn(Optional.of(approver));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(vehicleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleAccessRequestDto result = service.approveRequest(request.getId(), approver.getId());

        assertEquals(AccessRequestStatus.APPROVED, result.getStatus());
        assertEquals(Vehicle.VehicleStatus.approved, vehicle.getStatus());
        verify(vehicleRepository).save(vehicle);
    }

    @Test
    void approveRequest_forGateRequestWithNoVehicle_marksApprovedWithoutTouchingVehicle() {
        VehicleAccessRequest request = buildGateRequest();
        when(requestRepository.findById(request.getId())).thenReturn(Optional.of(request));
        when(userRepository.findById(approver.getId())).thenReturn(Optional.of(approver));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleAccessRequestDto result = service.approveRequest(request.getId(), approver.getId());

        assertEquals(AccessRequestStatus.APPROVED, result.getStatus());
        // No vehicle to flip: the vehicle repository is never touched.
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    void approveRequest_throwsWhenRequestNotFound() {
        UUID missingId = UUID.randomUUID();
        when(requestRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.approveRequest(missingId, approver.getId()));
    }

    // --- rejectRequest ---

    @Test
    void rejectRequest_setsRejectedWithReason() {
        VehicleAccessRequest request = buildPendingRequest();
        when(requestRepository.findById(request.getId())).thenReturn(Optional.of(request));
        when(userRepository.findById(approver.getId())).thenReturn(Optional.of(approver));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleAccessRequestDto result = service.rejectRequest(request.getId(), approver.getId(), "Not eligible");

        assertEquals(AccessRequestStatus.REJECTED, result.getStatus());
        assertEquals("Not eligible", result.getRejectionReason());
    }

    @Test
    void rejectRequest_throwsWhenReasonBlank() {
        VehicleAccessRequest request = buildPendingRequest();

        assertThrows(IllegalArgumentException.class,
                () -> service.rejectRequest(request.getId(), approver.getId(), ""));
    }

    @Test
    void rejectRequest_throwsWhenReasonNull() {
        VehicleAccessRequest request = buildPendingRequest();

        assertThrows(IllegalArgumentException.class,
                () -> service.rejectRequest(request.getId(), approver.getId(), null));
    }

    // --- cancelRequest ---

    @Test
    void cancelRequest_setsCancelledForOwner() {
        VehicleAccessRequest request = buildPendingRequest();
        when(requestRepository.findById(request.getId())).thenReturn(Optional.of(request));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleAccessRequestDto result = service.cancelRequest(request.getId(), requester.getId());

        assertEquals(AccessRequestStatus.CANCELLED, result.getStatus());
    }

    @Test
    void cancelRequest_throwsWhenNotOwner() {
        VehicleAccessRequest request = buildPendingRequest();
        UUID otherId = UUID.randomUUID();
        when(requestRepository.findById(request.getId())).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> service.cancelRequest(request.getId(), otherId));
    }

    @Test
    void cancelRequest_throwsForGateRequestWithNoRequester() {
        VehicleAccessRequest request = buildGateRequest();
        when(requestRepository.findById(request.getId())).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class,
                () -> service.cancelRequest(request.getId(), requester.getId()));
    }

    // --- recordGateDetection (Phase 4.4) ---

    @Test
    void recordGateDetection_createsPendingGateRequest() {
        Gate gate = Gate.builder().id(UUID.randomUUID()).name("Cong chinh").build();
        when(requestRepository.findByStatusAndSourceAndCreatedAtAfter(
                eq(AccessRequestStatus.PENDING), eq(RequestSource.GATE), any()))
                .thenReturn(List.of());
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VehicleAccessRequestDto result = service.recordGateDetection(
                "99X-12345", gate, "/uploads/snapshots/plate.jpg", Duration.ofSeconds(300));

        ArgumentCaptor<VehicleAccessRequest> captor = ArgumentCaptor.forClass(VehicleAccessRequest.class);
        verify(requestRepository).save(captor.capture());
        VehicleAccessRequest saved = captor.getValue();
        assertEquals(AccessRequestStatus.PENDING, saved.getStatus());
        assertEquals(RequestSource.GATE, saved.getSource());
        assertEquals("99X-12345", saved.getLicensePlate());
        assertEquals(gate, saved.getGate());
        assertEquals("/uploads/snapshots/plate.jpg", saved.getImagePath());
        assertNull(saved.getVehicle());
        assertNull(saved.getRequester());
        assertEquals(AccessRequestStatus.PENDING, result.getStatus());
    }

    @Test
    void recordGateDetection_suppressesDuplicateForSamePlateAndGate() {
        Gate gate = Gate.builder().id(UUID.randomUUID()).name("Cong chinh").build();
        VehicleAccessRequest existing = VehicleAccessRequest.builder()
                .id(UUID.randomUUID())
                .source(RequestSource.GATE)
                .status(AccessRequestStatus.PENDING)
                .licensePlate("99X-12345") // same plate, different formatting than the new read
                .gate(gate)
                .requestReason("existing")
                .build();
        when(requestRepository.findByStatusAndSourceAndCreatedAtAfter(
                eq(AccessRequestStatus.PENDING), eq(RequestSource.GATE), any()))
                .thenReturn(List.of(existing));

        // Same plate normalized ("99X12345"), same gate -> no new row saved.
        VehicleAccessRequestDto result = service.recordGateDetection(
                "99X 12345", gate, null, Duration.ofSeconds(300));

        verify(requestRepository, never()).save(any());
        assertEquals(existing.getId(), result.getId());
    }

    @Test
    void recordGateDetection_createsSeparateRequestForDifferentGate() {
        Gate gateA = Gate.builder().id(UUID.randomUUID()).name("Cong A").build();
        Gate gateB = Gate.builder().id(UUID.randomUUID()).name("Cong B").build();
        VehicleAccessRequest existingAtA = VehicleAccessRequest.builder()
                .id(UUID.randomUUID())
                .source(RequestSource.GATE)
                .status(AccessRequestStatus.PENDING)
                .licensePlate("99X-12345")
                .gate(gateA)
                .requestReason("existing")
                .build();
        when(requestRepository.findByStatusAndSourceAndCreatedAtAfter(
                eq(AccessRequestStatus.PENDING), eq(RequestSource.GATE), any()))
                .thenReturn(List.of(existingAtA));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.recordGateDetection("99X-12345", gateB, null, Duration.ofSeconds(300));

        // Same plate but a different gate is a distinct event -> a new row is saved.
        verify(requestRepository).save(any());
    }

    // --- getPendingRequests ---

    @Test
    void getPendingRequests_returnsOnlyPendingList() {
        VehicleAccessRequest r = buildPendingRequest();
        when(requestRepository.findByStatus(AccessRequestStatus.PENDING)).thenReturn(List.of(r));

        List<VehicleAccessRequestDto> results = service.getPendingRequests();

        assertEquals(1, results.size());
        assertEquals(AccessRequestStatus.PENDING, results.get(0).getStatus());
    }

    // --- getRequestsByRequester ---

    @Test
    void getRequestsByRequester_returnsOwnRequests() {
        VehicleAccessRequest r = buildPendingRequest();
        when(requestRepository.findByRequesterId(requester.getId())).thenReturn(List.of(r));

        List<VehicleAccessRequestDto> results = service.getRequestsByRequester(requester.getId());

        assertEquals(1, results.size());
    }

    // --- helpers ---

    private VehicleAccessRequest buildPendingRequest() {
        VehicleAccessRequest req = new VehicleAccessRequest();
        req.setId(UUID.randomUUID());
        req.setVehicle(vehicle);
        req.setRequester(requester);
        req.setStatus(AccessRequestStatus.PENDING);
        req.setRequestReason("Test reason");
        return req;
    }

    // A gate-originated request: no vehicle, no requester (Phase 4.4).
    private VehicleAccessRequest buildGateRequest() {
        VehicleAccessRequest req = new VehicleAccessRequest();
        req.setId(UUID.randomUUID());
        req.setSource(RequestSource.GATE);
        req.setStatus(AccessRequestStatus.PENDING);
        req.setLicensePlate("99X-12345");
        req.setRequestReason("Xe chua dang ky - phat hien tai cong");
        return req;
    }
}
