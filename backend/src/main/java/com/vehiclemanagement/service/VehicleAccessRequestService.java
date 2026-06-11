package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleAccessRequestDto;
import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.entity.Vehicle;
import com.vehiclemanagement.entity.VehicleAccessRequest;
import com.vehiclemanagement.entity.VehicleAccessRequest.AccessRequestStatus;
import com.vehiclemanagement.exception.ResourceNotFoundException;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.repository.VehicleAccessRequestRepository;
import com.vehiclemanagement.repository.VehicleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleAccessRequestService {

    @Autowired
    private VehicleAccessRequestRepository requestRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private UserRepository userRepository;

    public VehicleAccessRequestDto createRequest(UUID vehicleId, UUID requesterId,
                                                  String reason, LocalDate validFrom, LocalDate validTo) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found with id: " + vehicleId));
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + requesterId));

        VehicleAccessRequest request = VehicleAccessRequest.builder()
                .vehicle(vehicle)
                .requester(requester)
                .requestReason(reason)
                .validFrom(validFrom)
                .validTo(validTo)
                .status(AccessRequestStatus.PENDING)
                .build();

        return new VehicleAccessRequestDto(requestRepository.save(request));
    }

    public VehicleAccessRequestDto approveRequest(UUID requestId, UUID approverId) {
        VehicleAccessRequest request = getRequestOrThrow(requestId);
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + approverId));

        request.setStatus(AccessRequestStatus.APPROVED);
        request.setApprover(approver);

        Vehicle vehicle = request.getVehicle();
        vehicle.setStatus(Vehicle.VehicleStatus.approved);
        vehicleRepository.save(vehicle);

        return new VehicleAccessRequestDto(requestRepository.save(request));
    }

    public VehicleAccessRequestDto rejectRequest(UUID requestId, UUID approverId, String rejectionReason) {
        if (rejectionReason == null || rejectionReason.isBlank()) {
            throw new IllegalArgumentException("Rejection reason is required");
        }
        VehicleAccessRequest request = getRequestOrThrow(requestId);
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + approverId));

        request.setStatus(AccessRequestStatus.REJECTED);
        request.setApprover(approver);
        request.setRejectionReason(rejectionReason);

        return new VehicleAccessRequestDto(requestRepository.save(request));
    }

    public VehicleAccessRequestDto cancelRequest(UUID requestId, UUID requesterId) {
        VehicleAccessRequest request = getRequestOrThrow(requestId);
        if (!request.getRequester().getId().equals(requesterId)) {
            throw new IllegalArgumentException("You can only cancel your own requests");
        }
        request.setStatus(AccessRequestStatus.CANCELLED);
        return new VehicleAccessRequestDto(requestRepository.save(request));
    }

    @Transactional(readOnly = true)
    public List<VehicleAccessRequestDto> getPendingRequests() {
        return requestRepository.findByStatus(AccessRequestStatus.PENDING).stream()
                .map(VehicleAccessRequestDto::new)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<VehicleAccessRequestDto> getAllRequests() {
        return requestRepository.findAll().stream()
                .map(VehicleAccessRequestDto::new)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<VehicleAccessRequestDto> getRequestsByRequester(UUID userId) {
        return requestRepository.findByRequesterId(userId).stream()
                .map(VehicleAccessRequestDto::new)
                .collect(Collectors.toList());
    }

    private VehicleAccessRequest getRequestOrThrow(UUID requestId) {
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Access request not found with id: " + requestId));
    }
}
