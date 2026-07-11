package com.vehiclemanagement.service;

import com.vehiclemanagement.dto.VehicleAccessRequestDto;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class VehicleAccessRequestService {

    private static final Logger log = LoggerFactory.getLogger(VehicleAccessRequestService.class);

    @Autowired
    private VehicleAccessRequestRepository requestRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Record a gate detection of an unregistered / unapproved plate as a PENDING
     * access request so it lands in the approval queue with an audit trail (gate,
     * plate, time, evidence snapshot) instead of being silently denied at the gate
     * (Phase 4.4).
     *
     * <p>Duplicate suppression: if an identical PENDING gate request for the same
     * normalized plate and gate was created within {@code dedupWindow}, the existing
     * one is returned untouched rather than piling up a new row for every frame the
     * edge sends.
     *
     * @return the newly created (or matched existing) request; never {@code null}
     */
    public VehicleAccessRequestDto recordGateDetection(String licensePlate, Gate gate,
                                                       String imagePath, Duration dedupWindow) {
        LocalDateTime cutoff = LocalDateTime.now().minus(dedupWindow);
        String normalizedPlate = normalizePlate(licensePlate);
        UUID gateId = gate != null ? gate.getId() : null;

        Optional<VehicleAccessRequest> duplicate = requestRepository
                .findByStatusAndSourceAndCreatedAtAfter(AccessRequestStatus.PENDING, RequestSource.GATE, cutoff)
                .stream()
                .filter(r -> normalizedPlate.equals(normalizePlate(r.getLicensePlate())))
                .filter(r -> sameGate(gateId, r.getGate()))
                .findFirst();

        if (duplicate.isPresent()) {
            log.debug("Skipping duplicate gate access request for plate {} at gate {}",
                    licensePlate, gateId);
            return new VehicleAccessRequestDto(duplicate.get());
        }

        String reason = gate != null
                ? "Xe chưa đăng ký - phát hiện tại cổng " + gate.getName()
                : "Xe chưa đăng ký - phát hiện tại cổng";

        VehicleAccessRequest request = VehicleAccessRequest.builder()
                .source(RequestSource.GATE)
                .status(AccessRequestStatus.PENDING)
                .licensePlate(licensePlate)
                .gate(gate)
                .siteId(gate != null ? gate.getSiteId() : null)
                .imagePath(imagePath)
                .requestReason(reason)
                .build();

        return new VehicleAccessRequestDto(requestRepository.save(request));
    }

    private boolean sameGate(UUID gateId, Gate other) {
        UUID otherId = other != null ? other.getId() : null;
        return gateId == null ? otherId == null : gateId.equals(otherId);
    }

    private String normalizePlate(String plate) {
        return plate == null ? "" : plate.replaceAll("[-._\\s]", "").toUpperCase();
    }

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
                .siteId(vehicle.getCurrentSiteId())
                .build();

        return new VehicleAccessRequestDto(requestRepository.save(request));
    }

    public VehicleAccessRequestDto approveRequest(UUID requestId, UUID approverId) {
        VehicleAccessRequest request = getRequestOrThrow(requestId);
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + approverId));

        request.setStatus(AccessRequestStatus.APPROVED);
        request.setApprover(approver);

        // A manual request is tied to a registered vehicle: approving it flips the
        // vehicle to approved so the next gate check lets it through. A gate-detected
        // request for an unregistered plate has no vehicle yet, so approval is only an
        // audit decision (there is nothing to flip).
        Vehicle vehicle = request.getVehicle();
        if (vehicle != null) {
            vehicle.setStatus(Vehicle.VehicleStatus.approved);
            vehicleRepository.save(vehicle);
        }

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
        // Gate-detected requests have no human requester; they are resolved by an
        // approver, not self-cancelled.
        if (request.getRequester() == null) {
            throw new IllegalArgumentException("This request has no requester and cannot be cancelled");
        }
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
