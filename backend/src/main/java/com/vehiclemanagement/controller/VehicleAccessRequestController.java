package com.vehiclemanagement.controller;

import com.vehiclemanagement.dto.VehicleAccessRequestDto;
import com.vehiclemanagement.service.VehicleAccessRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.vehiclemanagement.entity.User;
import com.vehiclemanagement.repository.UserRepository;
import com.vehiclemanagement.exception.ResourceNotFoundException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/access-requests")
@Tag(name = "Vehicle Access Requests", description = "APIs for vehicle access approval workflow")
public class VehicleAccessRequestController {

    @Autowired
    private VehicleAccessRequestService accessRequestService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping
    @Operation(summary = "Create access request", description = "Submit a vehicle access request")
    public ResponseEntity<VehicleAccessRequestDto> createRequest(
            @Valid @RequestBody VehicleAccessRequestDto dto,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID requesterId = resolveUserId(userDetails);
        VehicleAccessRequestDto result = accessRequestService.createRequest(
                dto.getVehicleId(), requesterId,
                dto.getRequestReason(), dto.getValidFrom(), dto.getValidTo());
        return new ResponseEntity<>(result, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "List all requests", description = "Get all access requests (ADMIN/APPROVER only)")
    @PreAuthorize("hasAnyRole('ADMIN', 'APPROVER')")
    public ResponseEntity<List<VehicleAccessRequestDto>> getAllRequests() {
        return ResponseEntity.ok(accessRequestService.getAllRequests());
    }

    @GetMapping("/pending")
    @Operation(summary = "List pending requests", description = "Get all pending access requests (ADMIN/APPROVER only)")
    @PreAuthorize("hasAnyRole('ADMIN', 'APPROVER')")
    public ResponseEntity<List<VehicleAccessRequestDto>> getPendingRequests() {
        return ResponseEntity.ok(accessRequestService.getPendingRequests());
    }

    @GetMapping("/my")
    @Operation(summary = "List own requests", description = "Get current user's own access requests")
    public ResponseEntity<List<VehicleAccessRequestDto>> getMyRequests(
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID requesterId = resolveUserId(userDetails);
        return ResponseEntity.ok(accessRequestService.getRequestsByRequester(requesterId));
    }

    @PutMapping("/{id}/approve")
    @Operation(summary = "Approve request", description = "Approve a vehicle access request (ADMIN/APPROVER only)")
    @PreAuthorize("hasAnyRole('ADMIN', 'APPROVER')")
    public ResponseEntity<VehicleAccessRequestDto> approveRequest(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID approverId = resolveUserId(userDetails);
        return ResponseEntity.ok(accessRequestService.approveRequest(id, approverId));
    }

    @PutMapping("/{id}/reject")
    @Operation(summary = "Reject request", description = "Reject a vehicle access request with reason (ADMIN/APPROVER only)")
    @PreAuthorize("hasAnyRole('ADMIN', 'APPROVER')")
    public ResponseEntity<VehicleAccessRequestDto> rejectRequest(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID approverId = resolveUserId(userDetails);
        String reason = body.get("rejectionReason");
        return ResponseEntity.ok(accessRequestService.rejectRequest(id, approverId, reason));
    }

    @PutMapping("/{id}/cancel")
    @Operation(summary = "Cancel request", description = "Cancel own access request")
    public ResponseEntity<VehicleAccessRequestDto> cancelRequest(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID requesterId = resolveUserId(userDetails);
        return ResponseEntity.ok(accessRequestService.cancelRequest(id, requesterId));
    }

    private UUID resolveUserId(UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userDetails.getUsername()));
        return user.getId();
    }
}
